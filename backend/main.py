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

from routers import projects, graph  # noqa: E402 — after app is defined
app.include_router(projects.router, prefix="/api")
app.include_router(graph.router, prefix="/api")


@app.get("/api/health")
def health():
    try:
        check_connection()
        return {"status": "ok", "db": db_kind}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
