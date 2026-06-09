"""Regression tests for local development CORS behavior."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import get_cors_origin_regex


def _cors_test_client() -> TestClient:
    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=get_cors_origin_regex(),
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @test_app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return TestClient(test_app)


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:65124",
        "http://127.0.0.1:65124",
    ],
)
def test_debug_cors_allows_dynamic_localhost_ports(monkeypatch, origin):
    monkeypatch.setitem(settings._env_cache, "DEBUG", True)

    response = _cors_test_client().options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_non_debug_cors_regex_is_disabled(monkeypatch):
    monkeypatch.setitem(settings._env_cache, "DEBUG", False)

    assert get_cors_origin_regex() is None
