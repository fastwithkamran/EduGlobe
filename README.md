# Opportune PK

Opportune is a student opportunity discovery platform built for Pakistan and global learners.

It is designed to solve a real problem: students are currently forced to rely on random WhatsApp groups, scattered LinkedIn posts, emails, and social media pages to find hackathons, scholarships, internships, competitions, events, and announcements. At the same time, organizations struggle to market opportunities in one trusted place.

Opportune brings all of that into a single platform so students can discover what matters, follow organizations, and never miss an opportunity again.

---

## Problem Statement

Students and young professionals in Pakistan often miss valuable opportunities because information is fragmented across multiple channels:

- WhatsApp groups and forwarded messages
- LinkedIn posts that are easy to miss
- scattered university newsletters
- social media pages with inconsistent updates
- random event announcements across multiple communities

This makes opportunity discovery slow, unreliable, and unfair.

Organizations also face a challenge:

- their announcements are spread across too many channels
- event visibility is inconsistent
- they do not have one central place for students to discover and act on opportunities

Opportune solves this by creating a central, searchable, organized, and student-first platform for discovery.

---

## What the platform is for

Opportune is a centralized feed and community platform where students can:

- discover hackathons, scholarships, internships, events, and announcements
- follow universities, communities, organizations, and student groups
- browse opportunity posts from trusted sources
- get personalized updates through a social feed
- use an AI assistant to search for relevant opportunities faster
- stay informed without bouncing between multiple platforms

It is not just a static event listing. It is a live student opportunity ecosystem.

---

## Why this matters

A student should not have to spend hours searching for the right opportunity. They should be able to open one app and immediately see:

- what is happening now
- what is upcoming
- what is relevant to their field or interest
- which organizations are active and trustworthy

This is the idea behind Opportune.

---

## Core features

- Global opportunity feed with posts and updates
- Post categories for hackathons, scholarships, internships, announcements, and events
- Followable societies and organizations
- Student profiles and personalization
- Notifications for new updates and announcements
- AI-powered assistant for opportunity discovery
- Admin and super-admin tools to manage communities and content
- Organization-driven content publishing for events and opportunities

---

## 🌐 Live App

**Visit the site:** <https://opportune-pk.vercel.app>

---

## 🎬 Demo Video

[![▶ Watch Demo on LinkedIn](https://img.shields.io/badge/▶%20Watch%20Demo-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/feed/update/urn:li:ugcPost:7455169552008593409/)

---

## 🏆 Recognition

This project was recognized through the **Google AI Seekho 2026** initiative in collaboration with Pakistan’s Ministry of IT & Telecom, Telenor Pakistan, and Innovista.

Opportune was built as a platform to help students find opportunities faster using a modern feed experience and AI assistance.

---

## Stack

- Next.js
- TypeScript
- Firebase Authentication
- Firestore
- Firebase Storage
- Gemini AI
- Cloudinary
- Tailwind CSS

---

## Firebase and services

This project uses Firebase for:

- Google Sign-In / authentication
- Firestore database
- cloud storage for media uploads
- live feed and user data management

The Firebase config is located in [`firebase-applet-config.json`](./firebase-applet-config.json).

> Firestore and storage rules are defined in [`firestore.rules`](./firestore.rules) and [`storage.rules`](./storage.rules).

---

## 📁 Project structure

```text
Opportune/
├── .github/
│   └── workflows/
│       └── ci.yml
├── hooks/
│   └── use-mobile.ts
├── public/
│   ├── logo.png
│   ├── logo_bg.png
│   └── animations/
│       └── loading.json
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── ai/
│   │   │   │   └── page.tsx
│   │   │   ├── create-society/
│   │   │   │   └── page.tsx
│   │   │   ├── feed/
│   │   │   │   ├── _components/
│   │   │   │   │   ├── FeedSkeleton.tsx
│   │   │   │   │   └── PostCard.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── my-society/
│   │   │   │   ├── _components/
│   │   │   │   │   ├── AboutTab.tsx
│   │   │   │   │   ├── CommentThread.tsx
│   │   │   │   │   ├── PostComposer.tsx
│   │   │   │   │   └── SocietyPostCard.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   ├── super-admin/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── ai/
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── CommentThread.tsx
│   │   ├── Loader.tsx
│   │   └── OpportunityCard.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── firestore.ts
│   │   ├── gemini.ts
│   │   ├── postHelpers.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── .env.example
├── .gitignore
├── firebase-applet-config.json
├── firestore.rules
├── next.config.ts
├── package.json
├── README.md
├── storage.rules
├── tsconfig.json
└── vercel.json
```

---

## 🚀 Local setup

### Prerequisites

- Node.js 18+
- npm
- Gemini API key
- Firebase project
- Cloudinary account

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the required values.

```bash
copy .env.example .env.local
```

Required environment variables include:

| Variable | Description |
| --- | --- |
| `EDU_AI_KEY` | Gemini API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_DATABASE_ID` | Firestore database ID |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned preset |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FIREBASE_PROJECT_ID` | Firebase admin project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase private key |

### 3. Run the app

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

---

## 🛠️ Available scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

---

## Vision

Opportune aims to become the go-to discovery platform for students in Pakistan and beyond — a trusted place where opportunities are visible, searchable, timely, and community-driven.

The goal is simple:

No more scattered groups. No more missed deadlines. Just one platform where students can discover what is next.

---

*Built for the AI Seekho 2026 initiative and designed to serve student opportunity discovery at scale.*
