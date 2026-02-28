"""
Base HTTP client for WeatherAPI (https://www.weatherapi.com/docs/).

Usage
-----
from weather.client import WeatherClient

client = WeatherClient(api_key="YOUR_KEY")

# or pick it up automatically from the environment:
#   export WEATHERAPI_KEY="YOUR_KEY"
client = WeatherClient()
"""

from __future__ import annotations

import os

import requests
from requests import Response
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://api.weatherapi.com/v1"

# Retry on transient network errors (not on 4xx client errors).
_RETRY_STRATEGY = Retry(
    total=3,
    backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)


class WeatherAPIError(Exception):
    """Raised when WeatherAPI returns a non-2xx response."""

    def __init__(self, status_code: int, error_code: int, message: str) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        super().__init__(f"[HTTP {status_code}] WeatherAPI error {error_code}: {message}")


class WeatherClient:
    """
    Thin wrapper around requests.Session.

    Parameters
    ----------
    api_key:
        Your WeatherAPI key.  Falls back to the ``WEATHERAPI_KEY``
        environment variable when omitted.
    timeout:
        Request timeout in seconds (default 10).
    """

    def __init__(
        self,
        api_key: str | None = None,
        timeout: int = 10,
    ) -> None:
        self.api_key = api_key or os.environ.get("WEATHERAPI_KEY", "")
        if not self.api_key:
            raise ValueError(
                "No API key provided.  Pass api_key= or set the "
                "WEATHERAPI_KEY environment variable."
            )
        self.timeout = timeout
        self._session = self._build_session()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=_RETRY_STRATEGY)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    def _get(self, endpoint: str, params: dict) -> dict:
        """Execute a GET request and return parsed JSON, raising on errors."""
        params["key"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"

        response: Response = self._session.get(
            url, params=params, timeout=self.timeout
        )

        if not response.ok:
            try:
                body = response.json()
                err = body.get("error", {})
                raise WeatherAPIError(
                    status_code=response.status_code,
                    error_code=err.get("code", 0),
                    message=err.get("message", response.text),
                )
            except (ValueError, KeyError):
                response.raise_for_status()

        return response.json()

    # ------------------------------------------------------------------
    # Public convenience
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Release the underlying connection pool."""
        self._session.close()

    # Context-manager support: `with WeatherClient(...) as client:`
    def __enter__(self) -> "WeatherClient":
        return self

    def __exit__(self, *_) -> None:
        self.close()
