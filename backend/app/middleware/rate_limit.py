"""Redis-backed sliding-window rate limiter as a reusable FastAPI dependency.

Usage:
    from app.middleware.rate_limit import rate_limit

    @router.post("/login")
    async def login(..., _=Depends(rate_limit("login", max_requests=10, window_seconds=60))):
        ...
"""
import time
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.core.security import get_redis

_PREFIX = "rl:"


def rate_limit(
    key_suffix: str,
    max_requests: int = 10,
    window_seconds: int = 60,
) -> Callable:
    """
    Sliding-window rate limiter per IP + key_suffix.

    Args:
        key_suffix:     Identifies the endpoint (e.g. "login", "register").
        max_requests:   Max allowed calls in the window.
        window_seconds: Duration of the rolling window.
    """

    async def dependency(request: Request):
        redis = await get_redis()
        ip = request.client.host if request.client else "unknown"
        redis_key = f"{_PREFIX}{key_suffix}:{ip}"
        now = time.time()
        window_start = now - window_seconds

        pipe = redis.pipeline()
        # Remove old entries outside the window
        pipe.zremrangebyscore(redis_key, 0, window_start)
        # Add this request
        pipe.zadd(redis_key, {str(now): now})
        # Count requests in the window
        pipe.zcard(redis_key)
        # Auto-expire the key after the window
        pipe.expire(redis_key, window_seconds)
        results = await pipe.execute()

        request_count = results[2]
        if request_count > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Limit: {max_requests} per {window_seconds}s.",
                headers={"Retry-After": str(window_seconds)},
            )

    return Depends(dependency)
