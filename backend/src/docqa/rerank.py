"""Cross-encoder reranking: score (question, passage) pairs jointly instead of comparing two embeddings."""

from threading import Lock
from typing import Protocol


class Reranker(Protocol):
    def score(self, query: str, texts: list[str]) -> list[float]: ...


class FastEmbedReranker:
    """Local ONNX cross-encoder via FastEmbed. The model downloads and loads on first use."""

    def __init__(self, model_name: str):
        self.model_name = model_name
        self._model = None
        self._lock = Lock()

    def score(self, query: str, texts: list[str]) -> list[float]:
        if not texts:
            return []
        with self._lock:
            if self._model is None:
                from fastembed.rerank.cross_encoder import TextCrossEncoder

                self._model = TextCrossEncoder(model_name=self.model_name)
        return [float(s) for s in self._model.rerank(query, texts)]
