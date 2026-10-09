"""Hybrid retrieval: dense vectors and BM25 fused with reciprocal rank fusion."""

import math
import re
from collections import defaultdict
from dataclasses import dataclass

from rank_bm25 import BM25Okapi

from src.docqa.store import StoredChunk

_TOKEN = re.compile(r"[a-z0-9]+")
RRF_K = 60


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = RRF_K) -> list[tuple[str, float]]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, key in enumerate(ranking, start=1):
            scores[key] += 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)


@dataclass(frozen=True)
class Hit:
    chunk: StoredChunk
    score: float


class _LuceneBM25(BM25Okapi):
    """BM25 with Lucene's non-negative IDF. The Okapi IDF is zero or negative for a word in half or more
    of the chunks, which in a small library silently empties the keyword half of hybrid search."""

    def _calc_idf(self, nd):
        for word, freq in nd.items():
            self.idf[word] = math.log(1 + (self.corpus_size - freq + 0.5) / (freq + 0.5))
        self.average_idf = sum(self.idf.values()) / len(self.idf) if self.idf else 0.0


class Bm25Index:
    def __init__(self, chunks: list[StoredChunk]):
        self._chunks = chunks
        self._bm25 = _LuceneBM25([tokenize(c.text) for c in chunks]) if chunks else None

    def search(self, query: str, doc_ids: set[str] | None, limit: int) -> list[str]:
        tokens = tokenize(query)
        if self._bm25 is None or not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(zip(self._chunks, scores, strict=True), key=lambda pair: pair[1], reverse=True)
        return [chunk.key for chunk, score in ranked if score > 0 and (doc_ids is None or chunk.doc_id in doc_ids)][:limit]
