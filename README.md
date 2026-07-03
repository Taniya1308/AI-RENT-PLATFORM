# Rent & Flatmate Finder

AI-powered room rental platform with compatibility scoring, real-time chat, and email notifications.

---

## Setup

### Backend
```bash
cd backend
npm install
npm start
```
Runs at `http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm start
```
Runs at `http://localhost:3000`

---

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_here
OPENAI_API_KEY=sk-...         # optional, rule-based fallback used if absent
EMAIL_HOST=smtp.gmail.com     # optional, Ethereal preview used if absent
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=your_app_password
HIGH_SCORE_THRESHOLD=80
```

Create `frontend/.env`:

```env
HOST=localhost
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000/ws
```

---

## Demo Login

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rentfinder.com | admin123 |

Register tenant/owner accounts at `/register`.

---

## Tech Stack

- **Backend** — Node.js, Express, SQLite (sql.js), WebSocket
- **Frontend** — React 18, React Router 6
- **AI** — OpenAI GPT-3.5 + rule-based fallback
- **Email** — Nodemailer

---

## LLM Prompt

```
Given this room listing: <details>
And this tenant profile: <details>
Compute a compatibility score from 0 to 100 based on budget and location match.
Return JSON: { "score": number, "explanation": string }
```

**Example output:**
```json
{ "score": 88, "explanation": "Rent fits budget and location is a close match." }
```

**Fallback:** Budget (50pts) + Location (50pts) rule-based scoring when LLM is unavailable.

---

## Deploy

| Service | Platform |
|---------|---------|
| Backend | [Render](https://render.com) — Root: `backend`, Start: `npm start` |
| Frontend | [Vercel](https://vercel.com) — Root: `frontend`, Framework: Create React App |

Set `REACT_APP_API_URL` on Vercel and `FRONTEND_URL` on Render after both are deployed.
