import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import engine, db_kind, check_connection, Base
import models  # registers tables with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print(f"db: {db_kind}")
    yield


app = FastAPI(title="Knowledge Graph Explorer", lifespan=lifespan)


# ── Security headers ──────────────────────────────────────────────────────
# The app serves its own SPA + API from one origin behind an HTTPS proxy, so
# set a conservative baseline on every response. The CSP allows inline scripts
# (the pre-paint theme switcher in index.html) and inline styles (React
# style={{…}}), and blob: workers for the cola graph layout.
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "worker-src 'self' blob:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'"
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = _CSP
    if os.getenv("NODE_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


from routers import projects, graph  # noqa: E402 — after app is defined
app.include_router(projects.router, prefix="/api")
app.include_router(graph.router, prefix="/api")


@app.get("/api/health")
def health():
    try:
        check_connection()
        return {"status": "ok", "db": db_kind}
    except Exception as exc:
        # Log the detail server-side; don't leak DB/internal error text to clients.
        print(f"[health] check failed: {exc}")
        raise HTTPException(status_code=500, detail="Database connection failed")


@app.get("/api/hello")
def hello():
    return {"message": "Hello from the backend 👋"}


# --- Static frontend (production only) ---
_public = os.path.join(os.path.dirname(__file__), "public")

if os.getenv("NODE_ENV") == "production" and os.path.isdir(_public):
    _assets = os.path.join(_public, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Serve real static files at the web root (favicon, manifest, icons,
        # robots.txt …) when they exist; otherwise fall back to the SPA shell so
        # client-side routes resolve. Guards against path traversal by confining
        # the resolved path to the public directory.
        if full_path:
            candidate = os.path.normpath(os.path.join(_public, full_path))
            if candidate.startswith(_public + os.sep) and os.path.isfile(candidate):
                return FileResponse(candidate)
        return FileResponse(os.path.join(_public, "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3001"))
    reload = os.getenv("NODE_ENV") != "production"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
