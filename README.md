# Rent & Flatmate Finder

AI-powered room rental platform. Owners post listings, tenants create profiles, and an AI engine scores compatibility between them. Includes real-time chat and email notifications.

---

## Tech Stack

- **Backend** — Node.js, Express, SQLite (sql.js), WebSocket (ws)
- **Frontend** — React 18, React Router 6
- **AI Scoring** — OpenAI GPT-3.5 with rule-based fallback
- **Email** — Nodemailer (Ethereal for dev, SMTP/SendGrid for prod)

---

## Local Setup & Run

You need **two terminals** running simultaneously.

### Terminal 1 — Backend

```bash
cd backend
npm install
npm start
```

Runs at → `http://localhost:5000`

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm start
```

Runs at → `http://localhost:3000`

> The SQLite database and default admin account are created automatically on first start.

---

## Environment Variables

### `backend/.env`

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Optional — AI scoring (rule-based fallback used if not set)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo

# Optional — Email (Ethereal preview logged to console if not set)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Rent Finder <you@gmail.com>"

HIGH_SCORE_THRESHOLD=80
```

### `frontend/.env`

```env
HOST=localhost
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000/ws
```

---

## Deployment

### Backend → Render (free tier)

1. Push your project to a GitHub repository
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo
4. Set these options:

   | Setting | Value |
   |---------|-------|
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(long random string)* |
   | `FRONTEND_URL` | *(your Vercel URL — add after frontend deploy)* |
   | `OPENAI_API_KEY` | *(optional)* |
   | `EMAIL_HOST` etc. | *(optional)* |

6. Click **Deploy** — Render gives you a URL like `https://rent-finder-api.onrender.com`

> **Note:** Render free tier spins down after 15 min of inactivity. First request after sleep takes ~30s.

---

### Frontend → Vercel (free tier)

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Set these options:

   | Setting | Value |
   |---------|-------|
   | Root Directory | `frontend` |
   | Framework Preset | `Create React App` |
   | Build Command | `npm run build` |
   | Output Directory | `build` |

4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | `https://your-backend.onrender.com/api` |
   | `REACT_APP_WS_URL` | `wss://your-backend.onrender.com/ws` |

5. Click **Deploy** — Vercel gives you a URL like `https://rent-finder.vercel.app`

6. Go back to Render → update `FRONTEND_URL` to your Vercel URL → **Manual Deploy**

---

## Demo Accounts

| Role   | Email                  | Password  |
|--------|------------------------|-----------|
| Admin  | admin@rentfinder.com   | admin123  |

Register tenant and owner accounts through the UI at `/register`.

---

## Features

| Feature | Details |
|---------|---------|
| Auth | JWT login/register with roles: tenant, owner, admin |
| Listings | Owners post rooms with photos, location, rent, availability |
| AI Scoring | 0–100 compatibility score per tenant-listing pair, cached in DB |
| Fallback | Rule-based scoring if OpenAI is unavailable |
| Interests | Tenants send interest; owners accept or decline |
| Chat | Real-time WebSocket chat unlocked after acceptance |
| Notifications | Email alerts on high-match interest, acceptance, and decline |
| Admin Panel | Manage users, listings, interests, view email logs |

---

## Project Structure

```
rent-flatmate-finder/
├── backend/
│   ├── src/
│   │   ├── controllers/        # authController, listingController, etc.
│   │   ├── middleware/         # auth.js (JWT), upload.js (Multer)
│   │   ├── models/             # database.js (SQLite schema + seed)
│   │   ├── routes/             # auth, listings, tenant, interests, chat, admin
│   │   ├── services/           # compatibilityService, websocketService, emailService
│   │   └── server.js
│   ├── data/                   # SQLite DB (auto-created, gitignored)
│   ├── uploads/                # Listing photos (gitignored)
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/         # Navbar, ListingCard, ScoreBadge, Toast
    │   ├── context/            # AuthContext
    │   ├── hooks/              # useWebSocket
    │   ├── pages/              # Home, Login, Register, Listings, Chat, Admin, etc.
    │   ├── utils/              # api.js (fetch wrapper)
    │   └── App.js
    ├── vercel.json             # React Router SPA rewrite rules
    └── .env.example
```

---

## API Overview

Base URL: `http://localhost:5000/api`
Auth header: `Authorization: Bearer <token>`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register (role: tenant or owner) |
| POST | `/auth/login` | None | Login, returns JWT |
| GET | `/listings` | Optional | Browse listings (sorted by AI score for tenants) |
| POST | `/listings` | Owner | Create listing with photos |
| PATCH | `/listings/:id/mark-filled` | Owner | Hide listing from search |
| POST | `/tenant/profile` | Tenant | Create preference profile |
| POST | `/compatibility/batch` | Tenant | Compute AI scores for multiple listings |
| POST | `/interests` | Tenant | Send interest request |
| PATCH | `/interests/:id/accept` | Owner | Accept → opens chat + emails tenant |
| GET | `/chat/conversations` | Tenant/Owner | List conversations |
| GET | `/admin/stats` | Admin | Platform-wide statistics |

---

## AI Compatibility Scoring

**LLM Prompt:**
```
Given this room listing: <details>
And this tenant profile: <details>
Compute a compatibility score from 0 to 100 based on budget and location match.
Return JSON: { "score": number, "explanation": string }
```

**Example Output:**
```json
{
  "score": 88,
  "explanation": "Rent of $1,400 fits the $1,200–$1,600 budget and Islington is close to the tenant's preferred area of Angel."
}
```

**Rule-Based Fallback** (used when LLM unavailable):
- Budget match → up to 50 points
- Location match → up to 50 points
- Stored with `computed_by = 'rule_based'`, shown with ⚙ label in UI

---

## WebSocket (Chat)

Connect: `ws://localhost:5000/ws?token=<jwt>`

```json
{ "type": "send_message", "conversation_id": 1, "content": "Is it still available?" }
{ "type": "mark_read", "conversation_id": 1 }
```

Server broadcasts `new_message` to both participants. Reconnects automatically on disconnect.

---

## Database Schema

9 tables: `users`, `listings`, `listing_photos`, `tenant_profiles`, `compatibility_scores`, `interest_requests`, `conversations`, `messages`, `notifications`

Key design decisions:
- One `interest_request` per tenant-listing pair (unique constraint)
- One `conversation` created per accepted interest request
- One `compatibility_score` cached per tenant-listing pair, invalidated on profile update
