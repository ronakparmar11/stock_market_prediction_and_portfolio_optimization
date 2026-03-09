"""
Simple in-memory TTL cache to reduce repeated Yahoo Finance API calls.
Avoids external dependencies (Redis) while still giving meaningful performance gains.
"""
import time
import hashlib
import json
import threading
from typing import Any, Optional, Dict


class TTLCache:
    """Thread-safe in-memory LRU-style cache with TTL expiration."""

    def __init__(self, max_size: int = 500):
        self._store: Dict[str, tuple] = {}  # key -> (value, expires_at)
        self._lock = threading.Lock()
        self._max_size = max_size

    def _evict_expired(self):
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if exp < now]
        for k in expired:
            del self._store[k]

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int = 300):
        with self._lock:
            if len(self._store) >= self._max_size:
                self._evict_expired()
            self._store[key] = (value, time.time() + ttl)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def clear(self):
        with self._lock:
            self._store.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._store)

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            alive = sum(1 for _, (_, exp) in self._store.items() if exp > now)
            return {"total_keys": len(self._store), "alive_keys": alive}


def make_cache_key(*args) -> str:
    """Create a deterministic cache key from arbitrary arguments."""
    raw = json.dumps(args, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# Global singleton
cache = TTLCache(max_size=500)
