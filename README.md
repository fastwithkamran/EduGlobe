# EduGlobe 🌍

**EduGlobe** is a global discovery platform designed to connect students with a world of academic knowledge, opportunities, and insights.

Think of it as a personalized global feed for students, where they can:

* Discover content from a diverse range of sources: This includes universities, research institutions, organizations, NGOs, and individual scholars from around the globe.
* Follow what matters to them: Students can subscribe to pages and topics that align with their academic interests and career aspirations.
* Stay updated on key information: The platform delivers posts, updates, events, opportunities (like scholarships and internships), and valuable insights directly to their feed.

In essence, EduGlobe aims to democratize access to academic information and foster a global community of learners.

---

## 🌐 Live App

**Visit the site:** <https://tinyurl.com/eduglobe>

## 🎬 Demo Video

[![▶ Watch Demo on LinkedIn](https://img.shields.io/badge/▶%20Watch%20Demo-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/feed/update/urn:li:ugcPost:7455169552008593409/)

---

## 🚀 Run Locally

### Prerequisites

* [Node.js](https://nodejs.org/) v18+

* A [Gemini API Key](https://aistudio.google.com/apikey)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
copy .env.example .env.local
```

Then open `.env.local` and set:

| Variable | Description |
|---|---|
| `EDU_AI_KEY` | Your Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |
| `APP_URL` | `http://localhost:3000` for local dev |

### 3. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔥 Firebase

This project uses Firebase for:

* **Auth** — Google Sign-In
* **Firestore** — Database
* **Storage** — File uploads

The Firebase project config is in [`firebase-applet-config.json`](./firebase-applet-config.json) and is already wired up — no changes needed for local dev.

> **Note**: Firestore security rules are in [`firestore.rules`](./firestore.rules). If you hit permission errors, check your auth state.

---

## 📁 Project Structure

```
EduGlobe/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── admin/            # Authenticated app shell
│   │   │   ├── feed/         # Main content feed
│   │   │   ├── societies/    # Browse institutions/organisations
│   │   │   ├── society/      # Individual society page
│   │   │   ├── ai/           # AI Assistant page
│   │   │   ├── notifications/# Notifications
│   │   │   ├── settings/     # User settings
│   │   │   └── create-society/ # Create a new society
│   │   ├── api/
│   │   │   └── ai/           # Gemini AI API route (server-side)
│   │   ├── globals.css       # Global styles + Tailwind v4
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing / auth page
│   ├── contexts/
│   │   └── AuthContext.tsx   # Firebase auth state
│   ├── lib/
│   │   ├── firebase.ts       # Firebase app init
│   │   ├── firestore.ts      # Firestore helpers
│   │   └── gemini.ts         # Gemini AI service (server-only)
│   └── types/                # TypeScript types
├── hooks/
│   └── use-mobile.ts         # Responsive hook
├── lib/                      # Shared utilities
├── public/                   # Static assets
├── firebase-applet-config.json # Firebase config
├── firestore.rules           # Firestore security rules
├── storage.rules             # Storage security rules
├── next.config.ts            # Next.js config
└── .env.local                # ← Create this file (gitignored)
```

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

*Built for the AI Seekho 2026, a nationwide upskilling initiative launched by Google for Developers in collaboration with the Pakistani Ministry of IT & Telecom, Telenor Pakistan, and Innovista, built in AI Studio.*
