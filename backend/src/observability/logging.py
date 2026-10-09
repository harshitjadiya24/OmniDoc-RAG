"""One JSON log line per request (method, path, status, duration, request id), plus optional OpenTelemetry."""

import json
import logging
import time
import uuid

from fastapi import FastAPI, Request

logger = logging.getLogger("regrag.http")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname.lower(), "logger": record.name, "message": record.getMessage()}
        payload.update(getattr(record, "fields", {}))
        return json.dumps(payload, ensure_ascii=False)


def configure(app: FastAPI, json_logs: bool) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if json_logs else logging.Formatter("%(levelname)s %(message)s"))
    logger.handlers[:] = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            # Streaming responses log when headers are sent; generation time is in the done event's usage.
            logger.info(
                "request",
                extra={
                    "fields": {
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "duration_ms": round((time.perf_counter() - started) * 1000),
                    }
                },
            )

    _tracing(app)


def _tracing(app: FastAPI) -> None:
    """OpenTelemetry traces when OTEL_EXPORTER_OTLP_ENDPOINT is set and the instrumentation packages are installed."""
    import os

    if not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning("tracing requested but OpenTelemetry packages are missing; see requirements-otel.txt")
        return
    provider = TracerProvider(resource=Resource.create({"service.name": "regrag-api"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
