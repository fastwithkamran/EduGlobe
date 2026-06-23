# EduGlobe 🌍

**EduGlobe** is a global discovery platform that connects students worldwide with posts, updates, and knowledge from universities, institutions, organisations, NGOs, research bodies, and individual scholars.

---

## 🌐 Live App

Visit the site: https://tinyurl.com/eduglobe

## Demo Video

<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7455169552008593409?compact=1" height="399" width="504" frameborder="0" allowfullscreen="" title="Embedded post"></iframe>
---

## 🚀 Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A [Gemini API Key](https://aistudio.google.com/apikey)

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
- **Auth** — Google Sign-In
- **Firestore** — Database
- **Storage** — File uploads

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

*Built for the AI Seekho 2026, a nationwide upskilling initiative launched by Google for Developers in collaboration with the Pakistani Ministry of IT & Telecom, Telenor Pakistan, and Innovista, built in AI Studio*
