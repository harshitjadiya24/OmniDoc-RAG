"""FastEmbed wrapped in LangChain's embedding interface. Local, CPU, no API key."""

from fastembed import TextEmbedding


class FastEmbedWrapper:
    """Makes fastembed compatible with LangChain's embedding interface."""

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [e.tolist() for e in self.model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(self.model.embed([text])).tolist()
