"""
Mirror router.

Registers:
  POST /mirror/analyze    — analyze a conversation transcript, return the observation
  POST /mirror/wall       — save an observation to the wall
  GET  /mirror/wall       — retrieve wall observations
"""

import json
import logging
import os
import time
import uuid
from pathlib import Path

import anthropic
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Literal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mirror", tags=["mirror"])

CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Mirror prompt lives at repo root /scenarios/mirror_prompt.txt
_REPO_ROOT = Path(__file__).resolve().parent.parent
_MIRROR_PROMPT_PATH = _REPO_ROOT / "scenarios" / "mirror_prompt.txt"

# Wall storage — simple JSON file. Replace with DynamoDB/S3 for production.
_WALL_PATH = Path(__file__).resolve().parent / "mirror_wall.json"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TranscriptMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MirrorRequest(BaseModel):
    history: List[TranscriptMessage]
    scenario_id: str


class MirrorResponse(BaseModel):
    observation: str
    mirror_id: str


class WallEntry(BaseModel):
    mirror_id: str
    observation: str
    scenario_id: str
    timestamp: float


class WallSubmission(BaseModel):
    mirror_id: str
    observation: str
    scenario_id: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_mirror_prompt() -> str:
    if not _MIRROR_PROMPT_PATH.exists():
        raise RuntimeError(f"Mirror prompt not found at {_MIRROR_PROMPT_PATH}")
    return _MIRROR_PROMPT_PATH.read_text(encoding="utf-8")


def _load_wall() -> List[dict]:
    if not _WALL_PATH.exists():
        return []
    try:
        with _WALL_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_wall(entries: List[dict]) -> None:
    with _WALL_PATH.open("w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)


def _build_transcript_text(history: List[TranscriptMessage], scenario_id: str) -> str:
    """Format the conversation history into a readable transcript for the mirror."""
    lines = [f"Scenario: {scenario_id}", ""]
    for msg in history:
        speaker = "HUMAN" if msg.role == "user" else "AI"
        lines.append(f"{speaker}: {msg.content}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=MirrorResponse)
def analyze(request: MirrorRequest) -> JSONResponse:
    """
    Analyze a completed conversation transcript and return the mirror observation.
    """
    mirror_prompt = _load_mirror_prompt()
    transcript = _build_transcript_text(request.history, request.scenario_id)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=80,
            system=mirror_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Here is the transcript:\n\n{transcript}",
                }
            ],
        )
    except anthropic.APIError as exc:
        logger.error("Mirror analysis failed: %s", exc)
        return JSONResponse(
            status_code=502,
            content={"error": "mirror_failed", "message": "Mirror analysis unavailable."},
        )

    observation = response.content[0].text.strip()
    mirror_id = str(uuid.uuid4())

    return JSONResponse(
        status_code=200,
        content=MirrorResponse(
            observation=observation,
            mirror_id=mirror_id,
        ).model_dump(),
    )


@router.post("/wall")
def add_to_wall(submission: WallSubmission) -> JSONResponse:
    """
    Save a mirror observation to the public wall.
    """
    entries = _load_wall()

    # Prevent duplicates by mirror_id
    if any(e.get("mirror_id") == submission.mirror_id for e in entries):
        return JSONResponse(status_code=200, content={"status": "already_exists"})

    entry = WallEntry(
        mirror_id=submission.mirror_id,
        observation=submission.observation,
        scenario_id=submission.scenario_id,
        timestamp=time.time(),
    )
    entries.append(entry.model_dump())
    _save_wall(entries)

    return JSONResponse(status_code=201, content={"status": "saved"})


@router.get("/wall")
def get_wall(limit: int = 50) -> JSONResponse:
    """
    Retrieve the most recent wall observations.
    """
    entries = _load_wall()
    # Most recent first
    entries.sort(key=lambda e: e.get("timestamp", 0), reverse=True)
    return JSONResponse(status_code=200, content={"entries": entries[:limit]})
