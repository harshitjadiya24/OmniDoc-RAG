from types import SimpleNamespace

from src.docqa.summarize import summarize_document


class FakeLLM:
    def __init__(self, text):
        self._text = text

    def invoke(self, _prompt):
        return SimpleNamespace(text=self._text)


def test_parses_summary_and_questions_from_json():
    llm = FakeLLM('<think>ok</think>\n{"summary": "This is a lease.", "questions": ["When is rent due?", "Are pets allowed?"]}')
    summary, questions = summarize_document(llm, "Lease", "Some lease text about rent and pets.")
    assert summary == "This is a lease."
    assert questions == ["When is rent due?", "Are pets allowed?"]


def test_bad_output_fails_gracefully():
    summary, questions = summarize_document(FakeLLM("not json at all"), "Doc", "text")
    assert summary is None and questions == []


def test_empty_document_skips_the_model():
    calls = []

    class Spy:
        def invoke(self, prompt):
            calls.append(prompt)
            return SimpleNamespace(text="{}")

    summary, questions = summarize_document(Spy(), "Doc", "   ")
    assert summary is None and questions == [] and calls == []


def test_questions_are_capped_and_cleaned():
    llm = FakeLLM('{"summary": "x", "questions": ["  a? ", "", "b?", "c?", "d?", "e?", "f?"]}')
    _, questions = summarize_document(llm, "Doc", "body")
    assert questions == ["a?", "b?", "c?", "d?", "e?", "f?"]
