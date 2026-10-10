from types import SimpleNamespace

from src.docqa.summarize import summarize_document


class ScriptedLLM:
    """Answers each call with the next scripted reply (an exception is raised instead of returned)."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts: list[str] = []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, SimpleNamespace) else SimpleNamespace(text=reply, response_metadata={})


def test_questions_are_asked_first_then_the_summary():
    llm = ScriptedLLM('<think>ok</think>\n["When is rent due?", "Are pets allowed?"]', "<think>hm</think>This is a lease.")
    summary, questions = summarize_document(llm, "Lease", "Some lease text about rent and pets.")
    assert questions == ["When is rent due?", "Are pets allowed?"]
    assert summary == "This is a lease."
    assert "JSON array" in llm.prompts[0] and "summary" in llm.prompts[1]


def test_a_failed_summary_keeps_the_questions_and_vice_versa():
    assert summarize_document(ScriptedLLM('["a?"]', RuntimeError("rate limited")), "Doc", "body") == (None, ["a?"])
    assert summarize_document(ScriptedLLM(RuntimeError("rate limited"), "A summary."), "Doc", "body") == ("A summary.", [])


def test_bad_output_fails_gracefully():
    summary, questions = summarize_document(ScriptedLLM("not json at all", "   "), "Doc", "text")
    assert summary is None and questions == []


def test_a_summary_cut_off_at_the_output_cap_ends_at_its_last_complete_paragraph():
    cut = SimpleNamespace(
        text="Intro paragraph.\n\nSecond paragraph is complete.\n\nThird paragraph stops mid",
        response_metadata={"finish_reason": "length"},
    )
    summary, _ = summarize_document(ScriptedLLM("[]", cut), "Doc", "body")
    assert summary == "Intro paragraph.\n\nSecond paragraph is complete."
    lead_in = SimpleNamespace(
        text="Intro paragraph.\n\n## Key points\nThe article lists these functions:\n\n*   Memory consol",
        response_metadata={"finish_reason": "length"},
    )
    assert summarize_document(ScriptedLLM("[]", lead_in), "Doc", "body")[0] == "Intro paragraph."
    whole = SimpleNamespace(text="One paragraph.\n\nAnother that ends", response_metadata={"done_reason": "stop"})
    assert summarize_document(ScriptedLLM("[]", whole), "Doc", "body")[0] == "One paragraph.\n\nAnother that ends"


def test_empty_document_skips_the_model():
    llm = ScriptedLLM()
    assert summarize_document(llm, "Doc", "   ") == (None, []) and llm.prompts == []


def test_questions_are_capped_and_cleaned():
    llm = ScriptedLLM('["  a? ", "", "b?", "c?", "d?", "e?", "f?", "g?"]', "x")
    _, questions = summarize_document(llm, "Doc", "body")
    assert questions == ["a?", "b?", "c?", "d?", "e?", "f?"]
