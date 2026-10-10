FROM python:3.12-slim

# Tesseract for OCR of image-only pages; curl for the health check.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
# Fetch the embedding and rerank models at build time so the first request is not a download.
# A fixed cache path the runtime user owns: the default (/tmp, written as root) may not be writable later.
ENV FASTEMBED_CACHE_PATH=/app/models
RUN python -c "from fastembed import TextEmbedding; from fastembed.rerank.cross_encoder import TextCrossEncoder; TextEmbedding('BAAI/bge-small-en-v1.5'); TextCrossEncoder('Xenova/ms-marco-MiniLM-L-6-v2')"

RUN useradd --create-home --uid 1000 app && mkdir -p data/library && chown -R app data /app/models
USER app

ENV LIBRARY_DIR=/app/data/library
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fs http://localhost:8000/api/health || exit 1
# One worker: rate limits, upload jobs and the per-user library cache live in process memory.
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
