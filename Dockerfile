FROM node:20-alpine AS frontend-build
# Force a dev install so Vite (a devDependency) is available even when the
# platform injects NODE_ENV=production as a build-time env (which would
# otherwise make `npm install` skip devDependencies → "vite: not found").
ENV NODE_ENV=development
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --include=dev
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
# curl is required by the platform health check (python:3.12-slim ships neither
# curl nor wget), so a healthy /api/health probe can mark the container live.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
