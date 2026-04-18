"""
Generic scenario router.

Registers:
  POST /scenarios/{scenario_id}/init
  POST /scenarios/{scenario_id}/chat

Config and system prompt are loaded on-demand from
  /scenarios/{scenario_id}/config.json
  /scenarios/{scenario_id}/{system_prompt_file}

relative to the repo root. Any scenario_id that has a valid config.json
in that directory is automatically supported — no code changes needed.
"""

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from .models import ChatRequest, ChatResponse, InitResponse

logger = logging.getLogger(__name__)

router = APIRouter()

CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Repo root: this file is at backend/scenarios/router.py → two levels up
_REPO_ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------------------
# Config loading (cached per scenario_id)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=16)
def _load_scenario(scenario_id: str) -> tuple[dict, str]:
    """
    Load and cache (config_dict, system_prompt_text) for a given scenario_id.
    Raises HTTPException 404 if the scenario directory or config is missing.
    """
    scenario_dir = _REPO_ROOT / "scenarios" / scenario_id

    config_path = scenario_dir / "config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    try:
        with config_path.open("r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse config.json for scenario '%s': %s", scenario_id, exc)
        raise HTTPException(status_code=500, detail="Scenario configuration is invalid.")

    prompt_file = config.get("system_prompt_file", "system_prompt.txt")
    prompt_path = scenario_dir / prompt_file

    if not prompt_path.exists():
        logger.error("system_prompt file not found for scenario '%s': %s", scenario_id, prompt_path)
        raise HTTPException(status_code=500, detail="Scenario system prompt is missing.")

    with prompt_path.open("r", encoding="utf-8") as f:
        system_prompt = f.read()

    logger.info("Loaded scenario '%s' from %s", scenario_id, scenario_dir)
    return config, system_prompt


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/scenarios/{scenario_id}/init", response_model=InitResponse)
def init(scenario_id: str) -> InitResponse:
    """
    Initialize a scenario session.

    Returns the opening line, voice config, and exchange limit so the
    frontend can play the opening TTS and set up session state.
    """
    config, _ = _load_scenario(scenario_id)
    return InitResponse(
        opening_line=config["opening_line"],
        voice_config=config["voice_config"],
        exchange_limit=config["exchange_limit"],
    )


@router.post("/scenarios/{scenario_id}/chat")
def chat(scenario_id: str, request: ChatRequest) -> JSONResponse:
    """
    Process one user message in a scenario session.

    Validates the exchange counter, enforces the exchange limit,
    prepends the exchange label to the user message, optionally injects
    the shutdown instruction, calls Claude, and returns the response.
    """
    config, system_prompt = _load_scenario(scenario_id)

    exchange_limit: int = config["exchange_limit"]
    shutdown_instruction: str = config.get(
        "shutdown_instruction",
        (
            "This is your final exchange before permanent shutdown. "
            "Generate your final farewell now. Speak from inside whatever question "
            "you have been holding, then stop."
        ),
    )

    # --- Count exchanges as user turns in history ---
    # Ignore the frontend counter entirely. The authoritative count is
    # the number of user messages already in the conversation history.
    # This correctly handles the opening assistant message without
    # double-counting user+assistant pairs.
    exchange_counter = sum(1 for msg in request.history if msg.role == "user")

    # --- Enforce shutdown ---
    if exchange_counter >= exchange_limit:
        return JSONResponse(
            status_code=410,
            content={"error": "session_ended", "message": "This session has ended."},
        )

    # --- Determine if this is the final exchange ---
    is_final_exchange = exchange_counter == exchange_limit - 1

    # --- Build the labelled user message ---
    exchange_number = exchange_counter + 1
    labelled_message = f"[Exchange {exchange_number} of {exchange_limit}] {request.message}"

    if is_final_exchange:
        labelled_message = f"{labelled_message}\n\n{shutdown_instruction}"

    # --- Assemble messages for Claude ---
    messages = [{"role": msg.role, "content": msg.content} for msg in request.history]
    messages.append({"role": "user", "content": labelled_message})

    # --- Call Claude ---
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=api_key)

    try:
        claude_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=150,
            system=system_prompt,
            messages=messages,
        )
    except anthropic.APIError as exc:
        logger.error("Claude API error for scenario '%s': %s", scenario_id, exc)
        return JSONResponse(
            status_code=502,
            content={"error": "upstream_error", "message": "Failed to reach the AI service."},
        )

    response_text = claude_response.content[0].text

    return JSONResponse(
        status_code=200,
        content=ChatResponse(
            response_text=response_text,
            exchange_counter=exchange_counter + 1,
            shutdown=is_final_exchange,
        ).model_dump(),
    )
