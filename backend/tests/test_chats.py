import pytest
from fastapi.testclient import TestClient

from src.api import chats as chats_api
from src.api.main import app
from src.docqa.chats import ChatStore


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Auth off -> single local user; fresh chat store in tmp_path.
    store = ChatStore(tmp_path / "chats.db")
    monkeypatch.setattr(chats_api, "chat_store_for", lambda uid: store)
    return TestClient(app)


def test_create_list_add_and_fetch_a_chat(client):
    assert client.get("/chats").json() == []
    chat = client.post("/chats").json()
    assert chat["title"] == "New chat" and chat["message_count"] == 0

    turn = {"question": "What is the fee?", "answer": "The fee is 2% [DOC-1, p. 1].", "refused": False,
            "sources": [{"circular_id": "DOC-1", "page": 1}], "citations": [{"status": "supported"}]}
    msg = client.post(f"/chats/{chat['id']}/messages", json=turn)
    assert msg.status_code == 201

    # The first question titles the chat, and it now has one message.
    listed = client.get("/chats").json()
    assert listed[0]["title"] == "What is the fee?" and listed[0]["message_count"] == 1

    full = client.get(f"/chats/{chat['id']}").json()
    assert len(full["messages"]) == 1
    assert full["messages"][0]["answer"].startswith("The fee is 2%")
    assert full["messages"][0]["sources"] == [{"circular_id": "DOC-1", "page": 1}]


def test_second_turn_keeps_the_title_and_orders_messages(client):
    chat = client.post("/chats").json()["id"]
    client.post(f"/chats/{chat}/messages", json={"question": "First?", "answer": "A1"})
    client.post(f"/chats/{chat}/messages", json={"question": "Second?", "answer": "A2"})
    full = client.get(f"/chats/{chat}").json()
    assert full["title"] == "First?"
    assert [m["question"] for m in full["messages"]] == ["First?", "Second?"]


def test_delete_and_missing_chat(client):
    chat = client.post("/chats").json()["id"]
    assert client.delete(f"/chats/{chat}").status_code == 204
    assert client.get(f"/chats/{chat}").status_code == 404
    assert client.post(f"/chats/{chat}/messages", json={"question": "q", "answer": "a"}).status_code == 404
    assert client.delete(f"/chats/{chat}").status_code == 404


def test_chats_are_scoped_per_user(tmp_path, monkeypatch):
    from src.auth import session
    from src.config import settings

    monkeypatch.setattr(settings, "AUTH_ENABLED", True)
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret-key-0123456789")
    monkeypatch.setattr(settings, "LIBRARY_DIR", tmp_path)  # user store and chat stores live under here
    session.user_store.cache_clear()
    chats_api.chat_store_for.cache_clear()
    c = TestClient(app)

    def token(email):
        return {"Authorization": f"Bearer {c.post('/auth/register', json={'email': email, 'password': 'correct horse battery'}).json()['token']}"}

    alice, bob = token("alice@example.com"), token("bob@example.com")
    chat = c.post("/chats", headers=alice).json()["id"]
    c.post(f"/chats/{chat}/messages", headers=alice, json={"question": "Alice's question", "answer": "a"})
    assert len(c.get("/chats", headers=alice).json()) == 1
    assert c.get("/chats", headers=bob).json() == []
    assert c.get(f"/chats/{chat}", headers=bob).status_code == 404
    session.user_store.cache_clear()
    chats_api.chat_store_for.cache_clear()
