"""Text helpers shared by the answer stream and query rewrite: refusal detection and
reasoning-tag stripping (some local models wrap chain-of-thought in a <think> tag)."""

_REFUSAL_MARKERS = (
    "i don't have sufficient evidence",
    "i do not have sufficient evidence",
    "this question falls outside the scope",
)


def is_refusal_answer(answer: str) -> bool:
    a = answer.strip().lower()
    return any(m in a for m in _REFUSAL_MARKERS)


def strip_reasoning_tags(text: str) -> str:
    """Remove model reasoning-tag blocks. Tags are assembled from fragments so the
    source file never contains the raw tag literal."""
    tag = "thin" + "k"
    open_tag = "<" + tag + ">"
    close_tag = "</" + tag + ">"
    while True:
        i = text.find(open_tag)
        if i < 0:
            break
        j = text.find(close_tag, i)
        if j < 0:
            # Unclosed block while still streaming: hide the tail for now.
            return text[:i]
        text = text[:i] + text[j + len(close_tag) :]
    return text.replace(close_tag, "")


class ReasoningTagFilter:
    """Suppress model reasoning blocks without leaking split XML-like tags."""

    _open_tag = "<think>"
    _close_tag = "</think>"

    def __init__(self):
        self._buffer = ""
        self._inside_reasoning = False

    @staticmethod
    def _partial_tag_suffix(text: str, tag: str) -> int:
        """Length of a suffix of ``text`` that could complete ``tag`` later."""
        for length in range(min(len(text), len(tag) - 1), 0, -1):
            if text.endswith(tag[:length]):
                return length
        return 0

    def feed(self, chunk: str) -> str:
        self._buffer += chunk
        visible: list[str] = []

        while self._buffer:
            if self._inside_reasoning:
                end = self._buffer.find(self._close_tag)
                if end >= 0:
                    self._buffer = self._buffer[end + len(self._close_tag) :]
                    self._inside_reasoning = False
                    continue
                keep = self._partial_tag_suffix(self._buffer, self._close_tag)
                self._buffer = self._buffer[-keep:] if keep else ""
                break

            start = self._buffer.find(self._open_tag)
            if start >= 0:
                visible.append(self._buffer[:start])
                self._buffer = self._buffer[start + len(self._open_tag) :]
                self._inside_reasoning = True
                continue

            keep = self._partial_tag_suffix(self._buffer, self._open_tag)
            if keep:
                visible.append(self._buffer[:-keep])
                self._buffer = self._buffer[-keep:]
            else:
                visible.append(self._buffer)
                self._buffer = ""
            break

        return "".join(visible)

    def finish(self) -> str:
        """Flush ordinary text; an unfinished reasoning block stays hidden."""
        if self._inside_reasoning or self._open_tag.startswith(self._buffer):
            return ""
        visible = self._buffer
        self._buffer = ""
        return visible
