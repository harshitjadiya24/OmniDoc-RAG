import time

import pytest
from fastapi.testclient import TestClient

from src.api import library as library_api
from src.api import limits
from src.api.main import app
from src.auth import session
from src.auth.users import AccountError, UserStore
from src.config import settings
from src.docqa.engine import Library
from src.docqa.jobs import JobQueue
from tests.test_docqa import HashEmbedder, make_pdf


@pytest.fixture
def accounts(tmp_path, monkeypatch):
    """Auth on, a fresh user store, and per-user libraries in tmp_path built with the test embedder."""
    monkeypatch.setattr(settings, "AUTH_ENABLED", True)
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret-key-0123456789")
    monkeypatch.setattr(settings, "LIBRARY_DIR", tmp_path)  # user store and libraries never touch real data
    session.user_store.cache_clear()
    libs: dict[str, Library] = {}
    monkeypatch.setattr(
        library_api, "library_for", lambda uid: libs.setdefault(uid, Library(tmp_path / uid, HashEmbedder(), 5_000_000, 50))
    )
    monkeypatch.setattr(library_api, "job_queue", lambda q=JobQueue(1): q)
    limits.reset()
    yield TestClient(app), libs
    limits.reset()
    session.user_store.cache_clear()


def signup(client, email: str) -> dict:
    res = client.post("/auth/register", json={"email": email, "password": "correct horse battery"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_password_rules_and_duplicate_accounts(tmp_path):
    store = UserStore(tmp_path / "u.db")
    with pytest.raises(AccountError, match="valid email"):
        store.register("nope", "long enough password")
    with pytest.raises(AccountError, match="at least 10"):
        store.register("a@b.co", "short")
    store.register("A@B.co", "long enough password")
    with pytest.raises(AccountError, match="already exists"):
        store.register("a@b.co", "long enough password")
    assert store.authenticate("a@b.co", "long enough password") is not None
    assert store.authenticate("a@b.co", "wrong password!!") is None


def test_documents_need_a_session_and_libraries_are_private(accounts):
    client, _libs = accounts
    assert client.get("/documents").status_code == 401
    alice, bob = signup(client, "alice@example.com"), signup(client, "bob@example.com")
    res = client.post(
        "/documents?wait=true",
        headers=alice,
        files={"file": ("a.pdf", make_pdf([["Alice's private lease terms."]]), "application/pdf")},
    )
    assert res.status_code == 201
    doc_id = res.json()["id"]
    assert [d["id"] for d in client.get("/documents", headers=alice).json()] == [doc_id]
    assert client.get("/documents", headers=bob).json() == []
    assert client.get(f"/documents/{doc_id}/file", headers=bob).status_code == 404
    assert client.delete(f"/documents/{doc_id}", headers=bob).status_code == 404


def test_login_and_bad_tokens(accounts):
    client, _ = accounts
    signup(client, "carol@example.com")
    assert client.post("/auth/login", json={"email": "carol@example.com", "password": "nope nope nope"}).status_code == 401
    token = client.post("/auth/login", json={"email": "CAROL@example.com", "password": "correct horse battery"}).json()["token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "carol@example.com"
    assert client.get("/auth/me", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_uploads_run_as_background_jobs_visible_only_to_their_owner(accounts, monkeypatch):
    client, _ = accounts
    # Stub the model so the upload job's summary step is fast and deterministic (no real LLM call).
    monkeypatch.setattr("src.docqa.summarize.summarize_document", lambda llm, title, text: ("A short summary.", ["What is the deposit?"]))
    alice, bob = signup(client, "dan@example.com"), signup(client, "erin@example.com")
    res = client.post(
        "/documents", headers=alice, files={"file": ("b.pdf", make_pdf([["Deposit is refundable."]]), "application/pdf")}
    )
    assert res.status_code == 202 and res.json()["status"] in ("queued", "processing", "done")
    job_id = res.json()["id"]
    for _ in range(100):
        job = client.get(f"/documents/jobs/{job_id}", headers=alice).json()
        if job["status"] in ("done", "failed"):
            break
        time.sleep(0.05)
    assert job["status"] == "done" and job["document"]["filename"] == "b.pdf"
    # The summary and example questions generated during the job are returned with the document.
    assert job["document"]["summary"] == "A short summary."
    assert job["document"]["example_questions"] == ["What is the deposit?"]
    assert client.get(f"/documents/jobs/{job_id}", headers=bob).status_code == 404


def test_upload_rejects_non_pdf_immediately(accounts):
    client, _ = accounts
    res = client.post(
        "/documents", headers=signup(client, "f@example.com"), files={"file": ("x.pdf", b"hello", "application/pdf")}
    )
    assert res.status_code == 422


def test_asking_about_uploads_needs_a_session_and_is_rate_limited(accounts, monkeypatch):
    client, _ = accounts
    body = {"question": "what is the fee", "document_ids": []}
    assert client.post("/ask/stream", json=body).status_code == 401
    monkeypatch.setattr(settings, "ASK_PER_MINUTE", 2)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_PROVIDER", "gemini")
    headers = signup(client, "g@example.com")
    codes = [client.post("/ask/stream", json={**body, "provider": "gemini"}, headers=headers).status_code for _ in range(3)]
    assert codes == [422, 422, 429]


def test_auth_off_keeps_the_single_local_user(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_ENABLED", False)
    assert session.current_user(None).id == "local"
    assert TestClient(app).get("/auth/config").json() == {"auth_enabled": False}
    assert TestClient(app).post("/auth/login", json={"email": "a@b.co", "password": "x"}).status_code == 404
