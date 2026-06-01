"""Shared HTTP GET with bounded retry/backoff for external data sources.

Retries transient failures (connection errors and 429/5xx), honouring a
Retry-After header when present, and returns parsed JSON or None. This keeps a
single rate-limited response from silently producing an empty graph.
"""
import time
import requests

_RETRY_STATUS = {429, 500, 502, 503, 504}


def get_json(url, params=None, headers=None, timeout=10, retries=2, backoff=0.6):
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=timeout)
        except requests.RequestException as exc:
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt))
                continue
            print(f"[http] request error for {url}: {exc}")
            return None

        if resp.status_code in _RETRY_STATUS and attempt < retries:
            retry_after = resp.headers.get("Retry-After", "")
            wait = float(retry_after) if retry_after.isdigit() else backoff * (2 ** attempt)
            print(f"[http] {resp.status_code} from {url} — retrying in {min(wait, 5.0):.1f}s")
            time.sleep(min(wait, 5.0))
            continue

        if resp.status_code >= 400:
            print(f"[http] {resp.status_code} from {url} (giving up)")
            return None

        try:
            return resp.json()
        except ValueError:
            print(f"[http] non-JSON response from {url}")
            return None

    return None
