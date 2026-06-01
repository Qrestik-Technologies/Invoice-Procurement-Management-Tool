import asyncio

from app.api.routes.health import liveness


def test_liveness_handler():
    result = asyncio.run(liveness())
    assert result["status"] == "alive"
