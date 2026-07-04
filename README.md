# 🏠 Roomly – Rent & Flatmate Finder

A full-stack web application that helps property owners list rental properties and enables tenants to find compatible rooms using AI-based compatibility scoring, real-time chat, and email notifications.

🌐 **Live Demo:** [https://ai-rent-platform.vercel.app](https://ai-rent-platform.vercel.app)

---

## 📸 Preview

> ![alt text](image-1.png)

---

## ✨ Features

**👤 Authentication**

- JWT-based authentication
- Secure password hashing with bcryptjs
- Role-based access control (Owner & Tenant)
- Protected routes

**🏠 Owner Features**

- Create, update & delete property listings
- Mark listings as filled
- View & manage tenant interest requests
- Accept or reject tenant requests

**👥 Tenant Features**

- Browse available listings
- Create & update tenant profile
- Send interest requests to owners
- View AI compatibility scores

**🤖 AI Compatibility Matching**

- Evaluates budget, location & move-in date
- Returns a compatibility score (0–100)
- Provides a human-readable explanation
- Falls back to rule-based scoring if AI is unavailable

**💬 Real-time Chat**

- WebSocket-based messaging between owners and tenants

**📧 Email Notifications**

- Nodemailer integration for interest updates
- Falls back to console preview if SMTP is not configured

**🛡 Admin Panel**

- Manage users and listings
- Seeded default admin account

---

## 🛠 Tech Stack

**Frontend**

- React 18
- React Router DOM v6

**Backend**

- Node.js
- Express.js
- SQLite (sql.js)
- WebSocket (ws)
- Nodemailer
- OpenAI GPT-3.5

**Deployment**

- Frontend: [Vercel](https://vercel.com)
- Backend: [Render](https://render.com)

---

## 📂 Project Structure

```
ai-rent-platform/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── utils/
│       └── App.js
├── .gitignore
└── README.md
```

---

## 🚀 Installation

**Clone the repository**

```bash
git clone https://github.com/Taniya1308/AI-RENT-PLATFORM.git
cd ai-rent-platform
```

**Backend Setup**

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_here
OPENAI_API_KEY=sk-...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=your_app_password
HIGH_SCORE_THRESHOLD=80
```

Run backend:

```bash
npm run dev
```

Runs at `http://localhost:5000`

---

**Frontend Setup**

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000/ws
```

Run frontend:

```bash
npm start
```

Runs at `http://localhost:3000`

---

## 🔐 Environment Variables

**Backend**

```
PORT=
FRONTEND_URL=
JWT_SECRET=
OPENAI_API_KEY=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
HIGH_SCORE_THRESHOLD=
```

**Frontend**

```
REACT_APP_API_URL=
REACT_APP_WS_URL=
```

---

## 📌 API Endpoints

**Authentication**

```
POST /api/auth/register
POST /api/auth/login
```

**Listings**

```
GET    /api/listings
POST   /api/listings
PUT    /api/listings/:id
DELETE /api/listings/:id
```

**Tenant Profile**

```
GET  /api/tenant/profile
POST /api/tenant/profile
PUT  /api/tenant/profile
```

**Interests**

```
POST  /api/interests
GET   /api/interests/my
GET   /api/interests/owner
PATCH /api/interests/:id/accept
PATCH /api/interests/:id/reject
```

**Chat**

```
GET  /api/chat/:userId
POST /api/chat/:userId
```

---

## 🎯 Demo Login

| Role  | Email                | Password |
| ----- | -------------------- | -------- |
| Admin | admin@rentfinder.com | admin123 |

Register tenant/owner accounts at `/register`.

---

## 🤖 AI Prompt

```
Given this room listing: <details>
And this tenant profile: <details>
Compute a compatibility score from 0 to 100 based on budget and location match.
Return JSON: { "score": number, "explanation": string }
```

**Fallback:** Budget (50pts) + Location (50pts) rule-based scoring when OpenAI is unavailable.

---

## 🌍 Deployment

| Service  | Platform | Config                                        |
| -------- | -------- | --------------------------------------------- |
| Frontend | Vercel   | Root: `frontend`, Framework: Create React App |
| Backend  | Render   | Root: `backend`, Start: `node src/server.js`  |

Set `REACT_APP_API_URL` on Vercel and `FRONTEND_URL` on Render after both are deployed.

---

## 🎯 Future Improvements

- Google Maps Integration
- Property Image Upload Gallery
- Advanced Filters
- Reviews & Ratings
- Wishlist Feature
- Payment Integration

---

## 👩‍💻 Author

**Taniya Sharma**

GitHub: [Taniya1308](https://github.com/Taniya1308)
