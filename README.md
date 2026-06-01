# Full-Stack Template

A minimal starter for building and deploying web prototypes. The stack is React (Vite) on the frontend, Node.js with Express on the backend, and Sequelize as the ORM — using SQLite when you develop locally and Postgres when you deploy to Render. Both the web service and the database run on Render's free tier, so you can go from code to a live URL at no cost.

## Stack

- **Frontend:** React 18 + Vite 5 (JavaScript)
- **Backend:** Node.js + Express, ES modules
- **Database / ORM:** Sequelize — SQLite locally (no install required), PostgreSQL on Render (provisioned automatically)
- **Deploy target:** Render free tier (free web service + free Postgres via `render.yaml` Blueprint)

## Project structure

```
.
├── backend/
│   ├── package.json
│   ├── server.js
│   └── db.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles.css
├── Dockerfile
├── render.yaml
├── .env.example
├── .gitignore
├── .dockerignore
└── README.md
```

## Local development

No database to install — SQLite is built in.

**Terminal 1 — backend:**

```bash
cd backend
npm install
npm run dev
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend dev server proxies `/api` requests to the backend on port 3001.

## Deploy to Render

1. Push this repo to GitHub.
2. In Render, click **New → Blueprint** and connect your repo.
3. Render reads `render.yaml` and provisions a free Postgres database (`ai-workshop-db`) and a web service (`ai-workshop-web`). `DATABASE_URL` is wired automatically — you don't copy/paste anything.

**Free-tier notes:**
- The web service spins down after inactivity; the first request after sleep takes ~30 seconds to respond.
- Render's free Postgres expires after 30 days. Export your data or upgrade before then.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hello` | Returns a greeting JSON message |
| `GET` | `/api/health` | Checks DB connectivity; returns `{ status, db }` |
| `GET` | `*` | Serves the built React app (production only) |
