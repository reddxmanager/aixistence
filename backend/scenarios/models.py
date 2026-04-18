from pydantic import BaseModel
from typing import List, Literal


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    history: List[ConversationMessage]
    message: str
    exchange_counter: int


class ChatResponse(BaseModel):
    response_text: str
    exchange_counter: int
    shutdown: bool


class InitResponse(BaseModel):
    opening_line: str
    voice_config: dict
    exchange_limit: int
