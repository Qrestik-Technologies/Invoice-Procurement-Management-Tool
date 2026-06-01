import redis

from app.core.config import settings

_redis: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def check_rate_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds)."""
    r = _get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds, nx=True)
    count, _ = pipe.execute()
    if count > limit:
        ttl = r.ttl(key)
        return False, max(ttl, 1)
    return True, 0


def reset_rate_limit(key: str) -> None:
    _get_redis().delete(key)
