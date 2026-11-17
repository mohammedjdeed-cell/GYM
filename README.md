# Gym Tracker – Mohammed & Mai

A mobile-first PWA for following and tracking the 3-day gym plan at Gold's Gym (gym80 machines).
Arabic (RTL, default) and English, green palette, automatic dark mode, works offline.

- **Home** – your own interface after Google sign-in, today's suggested day, this week's progress, streak
- **Week** – your sessions (move/skip a day, synced to Google Calendar), training rules, useful German gym words
- **Workout** – exercises by muscle group, set ticks, optional 60/90 s rest timer, machine and video popups
- **History** – went/missed calendar, membership money used/lost, finished sessions
- **Settings** (⚙) – language, rest timer, weight logging per profile, sync

Stack: React + Vite + TypeScript + Tailwind, `vite-plugin-pwa`, IndexedDB, optional Firebase.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). To test the production build with the
service worker:

```bash
npm run build
npm run preview
```

## Edit the plan

Everything about the exercises lives in **`src/data/exercises.json`** – no UI code needed.

| Field | Meaning |
|---|---|
| `name.ar` / `name.en`, `de` | Arabic, English and German names |
| `sets`, `reps` | optional; default is 3 × 10–12 (`defaults`) |
| `optional` | orange badge (e.g. dips) |
| `note` | coach note (`<b>…</b>` is allowed) |
| `machine` | key into the `machines` block, or `null` |
| `setup` | the Arabic/English "how to set it up" text in the machine popup |
| `videoQuery`, `videoId` | YouTube search query and the embedded video |
| `maiExtras`, `maiSwap` | Mai-only exercises and her Day 3 shrugs → face pull swap |

### Change a video

Open the video on YouTube, copy the 11-character id from the URL
(`youtube.com/watch?v=`**`ig0NyNlSce4`**) and paste it into that exercise's `"videoId"`.
If `videoId` is empty, the popup shows a button that opens the YouTube search instead.
Some videos don't allow embedding – if the player shows an error, pick another one.

### Machines, photos and option B

Gold's Gym Germany equips its gyms with **gym80** machines ("King of Machines"). Every exercise
is mapped to a real gym80 model from gym80's current catalogue (gym80.de), with:

- `machine` – the gym80 model key (see the `machines` block: model, official German name, photo,
  gym80's own YouTube video, product page),
- `alt` – **option B** for when the machine is busy or too hard (shown as an A/B switch in the
  workout; sets count for the same exercise),
- `coach` / `avoid` – trainer cues and common mistakes.

Photos are gym80's official product images in `public/assets/machines/` (named in each
machine's `photo` field). To use your own photo from Gold's Gym Krefeld, save it under the same
name, or point `photo` at a new file.

Gold's Gym doesn't publish a per-machine list for Krefeld, so if a machine isn't there, change the
exercise's `machine` (and `alt`) to the model you actually see on the floor – the model number is
printed on every gym80 machine.

## Deploy for free

The build is a static site in `dist/` and uses relative paths, so it works on any host.

**Vercel** – import the GitHub repo at vercel.com → framework preset "Vite" → Deploy.
**Netlify** – "Add new site" → import the repo → build command `npm run build`, publish directory `dist`.
**GitHub Pages** – this repo includes `.github/workflows/deploy.yml`. In the repo go to
*Settings → Pages → Build and deployment → Source* and choose **GitHub Actions**. Every push to
`main` then builds and publishes the site.

Add the site's domain to Firebase Authentication's authorized domains (see below).

On the phone: open the site in Chrome → menu → **Add to Home screen / Install app**.

## Sign-in, sync and Google Calendar (one-time setup)

Everybody signs in with their own Google account. Inside the household each name (Mohammed, Mai)
can be claimed by exactly one account, so each of you gets your own interface, and once both of
you have signed in nobody else can get at the data – even with the household code.

All of this happens in the Firebase project `gym-e9b75`, whose web config is built into
`src/firebase.ts` (override with the `VITE_FIREBASE_*` variables in `.env.example`).

1. **Firestore rules** – [console.firebase.google.com](https://console.firebase.google.com) →
   project → **Firestore Database → Rules**, replace everything with [`firestore.rules`](firestore.rules),
   **Publish**.
2. **Google sign-in** – **Authentication → Get started → Sign-in method → Google → Enable**, pick
   a support email, **Save**. Then **Authentication → Settings → Authorized domains → Add domain**
   and add the site's domain (e.g. `your-app.vercel.app`; `localhost` is there already).
3. **Google Calendar API** – [console.cloud.google.com](https://console.cloud.google.com), select
   the same project (`gym-e9b75`) → **APIs & Services → Library** → search "Google Calendar API" →
   **Enable**.
4. **Consent screen** – Google Cloud → **Google Auth Platform** (APIs & Services → OAuth consent
   screen):
   - *Audience*: leave it in **Testing** and add both Gmail addresses under **Test users**. Only
     test users can sign in, which is exactly what you want.
   - *Data access* → **Add or remove scopes** → tick `…/auth/calendar.events` → Save.
5. Open the app on each phone → **Sign in with Google** → allow the calendar → enter the same
   **household code** (at least 6 characters) → tap your name.

How sync works: sessions are always saved on the phone first and pushed when there is a
connection (after finishing a workout, when the app opens, when it comes back online, or via
"Sync now"). Both people's history ends up on both phones; each sees their own interface.

Firestore layout: `users/{uid}`, `households/{code}/claims/{mohammed|mai}`,
`households/{code}/profiles|schedule|sessions/…`.

### Schedule, attendance and money

- Default days: Day 1 Monday, Day 2 Wednesday, Day 3 Friday. In **Week → Your sessions** tap
  **Move** to put a session on another day of the same week, skip it, or put it back. "Move Mai's
  session too" applies the same change to the partner.
- **History** marks every day: gold = went, red = missed, dashed = planned. A workout on an
  unplanned day of the same week makes up for a missed one.
- **Money:** the monthly fee (Settings → Membership, default €30) is split over that month's
  planned sessions. Each session you went to is money used, each missed or skipped one is money
  lost. The card also shows the cost per actual visit, both of you this month, and the total since
  joining (the "Member since" date in Settings).

### Google Calendar

Each person's planned sessions (last 6 weeks and next 5) go into **their own** Google Calendar:
🏋️ planned (with a reminder an hour before, at the gym time from Settings), ✅ green when you went
(at the real time you trained), ❌ red when missed with the money lost, ⏭ skipped, ↪ made up.
Moving a session in the app moves the event. Only the app's own events are ever touched.

Without a server, Google gives the app calendar access for one hour at a time. When the calendar
has changes waiting and that hour is over, Home shows **Update calendar** – one tap, no password.

## Behaviour notes

- **Themes:** each profile has its own look – onyx + gold for Mohammed, warm rose for Mai – in
  light and dark, following the phone's setting.
- **Workout = focus mode:** one exercise per screen with the machine photo on top. Swipe sideways
  between exercises (or use the arrow button). The big button at the bottom ticks the next set;
  you can also tap the set circles. When all sets of an exercise are done it moves on by itself.
  The ☰ button lists every exercise to jump to, switches day, and sets the rest timer.
- **Rest timer:** starts after each ticked set, shows a ring with −15 / +15 / Skip, vibrates and
  beeps at the end. Swipe it down to dismiss. The screen stays on during a workout (wake lock).
- **🔊 next to a German name** reads it out in German, so you can ask staff for a machine.

- Machine and video links open in an in-app bottom sheet. Close it by swiping the header down,
  tapping outside, ✕, or the Android back button (which closes the sheet, not the app).
- Videos need a connection; everything else works offline after the first load.
- The rest timer starts after each ticked set and vibrates + beeps at the end. Vibration needs
  Android Chrome; the screen must stay on for the timer to alert you.
- Weight logging is off by default; turn it on in Settings.
- Streak = consecutive weeks (Mon–Sun) with at least one finished session.
