<div align="center">

<img src="./assets/logo_v6.png" width="96" height="96" alt="GoCheck logo" />

# GoCheck

### Snap. Split. Get paid back.

**The bill-splitter that does the awkward chasing for you — and uses AI to verify every payment.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-go--check.vercel.app-6366F1?style=for-the-badge)](https://go-check.vercel.app)

![Expo](https://img.shields.io/badge/Expo-51-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_+_Edge-3ECF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Google_Gemini-8B5CF6?logo=googlegemini&logoColor=white)

</div>

---

## 💡 What is GoCheck?

Splitting a bill is easy. **Collecting the money is the painful part** — chasing friends, wondering if they really paid, screenshotting "I've transferred ya" messages that may or may not be true.

GoCheck removes that friction end-to-end. An organizer creates a bill, drops **one link** in the group chat, and members pay and upload proof. Then GoCheck's twist: **AI reads the payment receipt and confirms the amount actually matches** — so "I already paid" finally means they did.

Built for group meals, trips, events, house bills, sports sessions, class fees, and community collections.

> 🟢 **Try it now → [go-check.vercel.app](https://go-check.vercel.app)** — runs on web, optimized for opening from WhatsApp on your phone.

---

## ✨ What makes it different

Most split-bill apps stop at arithmetic. GoCheck goes further:

| 🧾 **AI receipt scan** | Snap a photo of the restaurant receipt — Gemini reads the line items and drafts the split for you. |
|:--|:--|
| 🛡️ **AI payment verification** | A member uploads their bank/e-wallet transfer screenshot. AI extracts the amount, bank, and reference, then checks it against what they owe — flagging mismatches automatically. |
| 🌍 **Multi-currency, live FX** | Bill in MYR, SGD, USD and more. Change the currency and amounts auto-convert at live rates — perfect for trips. |
| 🔔 **Smart reminders** | GoCheck nudges only the unpaid members, in a tone and cadence you choose, so you stay the good guy. |
| 📊 **Reports & insights** | Spending by category, collection forecasts, and CSV / PDF export. |
| 🌗 **Polished & accessible** | Dark mode, biometric lock (Face ID / fingerprint), liquid progress visuals, and motion that respects reduce-motion settings. |

---

## 🎯 Core flow

```
Organizer                         Member
─────────                         ──────
Create bill ──────────────►  Open shareable link
(title, amount, due date,         View what they owe
 participants, description)       Pay → upload proof
        │                              │
        │                    🤖 AI verifies the receipt
        ▼                              │
Live dashboard ◄───────────────────────┘
(paid / unpaid, total collected,
 remaining, payment progress)
```

---

## ✅ Requirements coverage

Every bounty requirement is met — and then some:

| # | Requirement | How GoCheck delivers |
|---|---|---|
| 1 | Bill creation | Title, amount, participants, due date, description, currency, tax & line items |
| 2 | Shareable bill page | Unique share link (`/share/{code}`) + per-member link (`/p/{token}`) |
| 3 | Member payment confirmation | One-tap confirm + proof upload, **AI-verified** |
| 4 | Organizer dashboard | Real-time paid / unpaid tracking across all bills |
| 5 | Payment progress display | Live "total collected / remaining" with liquid progress visuals |
| 6 | Mobile-friendly | Built mobile-first on Expo; WhatsApp-link optimized |
| 7 | Creative theme / branding | Aurora + glass + glow visual identity, custom-built |
| 8 | GitHub repository | This repo |
| 9 | Project description | This README |
| 10 | Bonus features | AI receipt scan, AI proof verification, multi-currency FX, smart reminders, reports/export, dark mode, biometric lock |
| 11 | Minimum acceptance criteria | Full create → share → pay → track loop, working live |

---

## 🏗️ Tech stack

- **App:** [Expo](https://expo.dev) (React Native + React Native Web) · Expo Router · TypeScript
- **State / forms:** Zustand · React Hook Form + Zod
- **Motion:** React Native Reanimated
- **Backend:** [Supabase](https://supabase.com) — Postgres, Auth (Google OAuth), Storage
- **AI:** [Google Gemini](https://ai.google.dev) via Supabase Edge Functions (Deno)
- **Hosting:** Vercel (web export) — [go-check.vercel.app](https://go-check.vercel.app)

### AI Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `gemini-scan-receipt` | Read a receipt photo → itemized split |
| `scan-payment-proof` | Read a payment screenshot → verify amount vs. expected |
| `gemini-suggest-split` | Suggest how to divide a bill |
| `gemini-suggest-title` | Suggest a bill title |
| `gemini-invoice-summary` | Generate an invoice summary |
| `notify-organizer` | Notify the organizer of payment activity |

---

## 🚀 Run it locally

> **Requirements:** Node.js 18+ and npm. The repo ships pointed at the hosted backend, so it runs out of the box — no setup needed just to try it.

```bash
git clone https://github.com/daus7768/GoCheck.git
cd GoCheck
npm install

# Web (opens http://localhost:8081)
npm run web

# Or native via Expo Go / a dev build
npm run ios
npm run android
```

Useful scripts: `npm test` (Jest) · `npm run typecheck` (tsc) · `npm run lint` (ESLint) · `npm run build` (web export to `dist/`).

---

## 🔧 Run against your own backend (optional)

To fork GoCheck onto your own Supabase project:

1. **Create a Supabase project** and apply the schema from [`supabase/migrations/`](supabase/migrations).
2. **Point the app at it** — set `supabaseUrl` and `supabaseAnonKey` in [`app.json`](app.json) → `expo.extra`.
3. **Enable Google OAuth** in Supabase Auth, with redirect `https://<your-domain>/auth/callback`.
4. **Deploy the Edge Functions** and set their secrets:
   ```bash
   supabase functions deploy
   supabase secrets set GEMINI_API_KEY=your_key INTERNAL_SECRET=your_secret
   ```
5. **Share links:** set `EXPO_PUBLIC_WEB_BASE_URL` (or `app.json` → `extra.shareBaseUrl`) to your deployed URL.

Deploying the web build to Vercel:

```
Build command:    npx expo export --platform web
Output directory: dist
Env var:          EXPO_PUBLIC_WEB_BASE_URL = https://<your-project>.vercel.app
```

---

## 📸 Screenshots

<!-- Add 2–3 phone screenshots here for maximum impact:
     e.g. the sign-in screen, a bill dashboard with progress, and the AI proof-verification result.
     ![Dashboard](./assets/screens/dashboard.png) -->

See it live instead → **[go-check.vercel.app](https://go-check.vercel.app)**

---

## 📝 Notes

- **Payments are simulated** — no real gateway. Members confirm and upload proof; the organizer (and AI) verify. This matches the brief's accepted manual/simulated flow.
- **License:** MIT.

<div align="center">

**Made with care for people who hate chasing friends for money.**

</div>
