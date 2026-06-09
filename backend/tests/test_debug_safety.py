"""Tests for runtime debug-safety: global exception handling and /reload-config gating."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def _raise_exception():
    raise RuntimeError("intentional test exception")


@pytest.fixture(autouse=True)
def restore_debug():
    """Restore DEBUG setting after each test."""
    original = settings.DEBUG
    yield
    settings._env_cache["DEBUG"] = original


class TestGlobalExceptionHandler:
    """3.1 / 3.2 Global exception handler behavior in debug vs non-debug."""

    def test_non_debug_exception_is_sanitized(self, monkeypatch):
        """Production 500 responses do not expose tracebacks or request internals."""
        monkeypatch.setitem(settings._env_cache, "DEBUG", False)

        app.add_api_route("/_test-raise", _raise_exception, methods=["GET"])
        client = TestClient(app, raise_server_exceptions=False)
        try:
            response = client.get("/_test-raise")
        finally:
            app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/_test-raise"]

        assert response.status_code == 500
        payload = response.json()

        assert "detail" in payload
        raw_text = response.text
        assert "traceback" not in raw_text.lower()
        assert "error_info" not in raw_text.lower()
        assert "intentional test exception" not in raw_text
        assert "traceback" not in payload
        assert "error_info" not in payload

    def test_debug_exception_includes_diagnostics(self, monkeypatch):
        """Debug-mode 500 responses may include diagnostic details."""
        monkeypatch.setitem(settings._env_cache, "DEBUG", True)

        app.add_api_route("/_test-raise", _raise_exception, methods=["GET"])
        client = TestClient(app, raise_server_exceptions=False)
        try:
            response = client.get("/_test-raise")
        finally:
            app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/_test-raise"]

        assert response.status_code == 500
        payload = response.json()
        assert "detail" in payload

    def test_server_logs_still_record_exception(self, monkeypatch, caplog):
        """3.5 Server-side logs preserve exception diagnostics even when client response is sanitized."""
        monkeypatch.setitem(settings._env_cache, "DEBUG", False)

        app.add_api_route("/_test-raise", _raise_exception, methods=["GET"])
        client = TestClient(app, raise_server_exceptions=False)
        try:
            with caplog.at_level("ERROR"):
                response = client.get("/_test-raise")
        finally:
            app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/_test-raise"]

        assert response.status_code == 500
        assert "intentional test exception" in caplog.text or "Unhandled exception" in caplog.text


class TestReloadConfigGating:
    """3.4 /reload-config endpoint gating."""

    def test_reload_config_rejected_outside_debug(self, monkeypatch):
        """Reload is rejected when DEBUG is false."""
        monkeypatch.setitem(settings._env_cache, "DEBUG", False)

        response = TestClient(app).post("/reload-config")
        assert response.status_code == 403
        assert "detail" in response.json()

    def test_reload_config_allowed_in_debug(self, monkeypatch):
        """Reload succeeds when DEBUG is true."""
        monkeypatch.setitem(settings._env_cache, "DEBUG", True)

        response = TestClient(app).post("/reload-config")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success"
