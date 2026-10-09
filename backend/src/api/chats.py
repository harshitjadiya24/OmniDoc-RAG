"""Per-user chat sessions: GET/POST /chats, GET/DELETE /chats/{id}, POST /chats/{id}/messages."""

from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.auth.session import current_user
from src.auth.users import User
from src.config import settings
from src.docqa.chats import Chat, ChatStore, Message

router = APIRouter(prefix="/chats", tags=["chats"])


@lru_cache(maxsize=256)
def chat_store_for(user_id: str) -> ChatStore:
    directory = settings.LIBRARY_DIR if user_id == "local" else settings.LIBRARY_DIR / "users" / user_id
    return ChatStore(directory / "chats.db")


def get_store(user: User = Depends(current_user)) -> ChatStore:
    return chat_store_for(user.id)


class MessageIn(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    answer: str = Field(..., max_length=20000)
    refused: bool = False
    sources: list = Field(default_factory=list)
    citations: list = Field(default_factory=list)


class MessageOut(BaseModel):
    id: str
    question: str
    answer: str
    refused: bool
    sources: list
    citations: list
    created_at: str


class ChatOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    messages: list[MessageOut] = []


def _message_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        question=m.question,
        answer=m.answer,
        refused=m.refused,
        sources=m.sources,
        citations=m.citations,
        created_at=m.created_at,
    )


def _chat_out(c: Chat, with_messages: bool = False) -> ChatOut:
    return ChatOut(
        id=c.id,
        title=c.title,
        created_at=c.created_at,
        updated_at=c.updated_at,
        message_count=c.message_count,
        messages=[_message_out(m) for m in c.messages] if with_messages else [],
    )


@router.get("", response_model=list[ChatOut])
def list_chats(store: ChatStore = Depends(get_store)) -> list[ChatOut]:
    return [_chat_out(c) for c in store.list()]


@router.post("", response_model=ChatOut, status_code=201)
def create_chat(store: ChatStore = Depends(get_store)) -> ChatOut:
    return _chat_out(store.create())


@router.get("/{chat_id}", response_model=ChatOut)
def get_chat(chat_id: str, store: ChatStore = Depends(get_store)) -> ChatOut:
    chat = store.get(chat_id)
    if chat is None:
        raise HTTPException(404, "Chat not found.")
    return _chat_out(chat, with_messages=True)


@router.post("/{chat_id}/messages", response_model=MessageOut, status_code=201)
def add_message(chat_id: str, body: MessageIn, store: ChatStore = Depends(get_store)) -> MessageOut:
    msg = store.add_message(chat_id, body.question, body.answer, body.refused, body.sources, body.citations)
    if msg is None:
        raise HTTPException(404, "Chat not found.")
    return _message_out(msg)


@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat_id: str, store: ChatStore = Depends(get_store)) -> None:
    if not store.delete(chat_id):
        raise HTTPException(404, "Chat not found.")
