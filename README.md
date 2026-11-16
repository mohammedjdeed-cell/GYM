# Gym Tracker – Mohammed & Mai

A mobile-first PWA for following and tracking the 3-day gym plan at Gold's Gym (gym80 machines).
Arabic (RTL, default) and English, green palette, automatic dark mode, works offline.

- **Home** – profile switcher, today's suggested day, this week's progress, streak
- **Week** – schedule, training rules, useful German gym words
- **Workout** – exercises by muscle group, set ticks, optional 60/90 s rest timer, machine and video popups
- **History** – per-profile calendar and list of finished sessions
- **Settings** (⚙) – language, rest timer, weight logging per profile, sync

Stack: React + Vite + TypeScript + Tailwind, `vite-plugin-pwa`, IndexedDB, optional Supabase.

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

### Add machine photos

Each machine has a `photo` file name in the `machines` block, e.g. `sygnum-3016.jpg`.
Drop a photo with exactly that name into **`public/assets/machines/`** and rebuild/redeploy.
Until the file exists the popup shows a placeholder with the expected file name.

Expected files: `pure-kraft-4329n.jpg`, `sygnum-3016.jpg`, `sygnum-3021.jpg`, `sygnum-4004.jpg`,
`sygnum-3004.jpg`, `pure-kraft-4018.jpg`, `sygnum-4016.jpg`, `sygnum-3098.jpg`, `sygnum-3001.jpg`,
`sygnum-3031.jpg`, `sygnum-3013.jpg`, `sygnum-3032.jpg`, `sygnum-3050.jpg`, `sygnum-3025.jpg`,
`sygnum-3005.jpg`, `sygnum-3028.jpg`.

Landscape photos around 1200 px wide are plenty. Take them yourself in the gym or use images you
have the right to use.

## Deploy for free

The build is a static site in `dist/` and uses relative paths, so it works on any host.

**Vercel** – import the GitHub repo at vercel.com → framework preset "Vite" → Deploy.
**Netlify** – "Add new site" → import the repo → build command `npm run build`, publish directory `dist`.
**GitHub Pages** – this repo includes `.github/workflows/deploy.yml`. In the repo go to
*Settings → Pages → Build and deployment → Source* and choose **GitHub Actions**. Every push to
`main` then builds and publishes the site.

For sync, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on the
host (Vercel/Netlify: project settings → Environment variables; GitHub Pages: repo
*Settings → Secrets and variables → Actions → Variables*), then redeploy.

On the phone: open the site in Chrome → menu → **Add to Home screen / Install app**.

## Sync between two phones (Supabase, optional)

Without Supabase the app works fully, storing everything on the phone (IndexedDB).
To share history between both phones:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   It creates the tables `profiles`, `sessions` and `set_logs`.
3. In **Project Settings → API** copy the *Project URL* and the *anon public* key.
4. Locally: copy `.env.example` to `.env` and fill both values. On your host: add them as
   environment variables (see above). Rebuild / redeploy.
5. On each phone open ⚙ **Settings → Sync**, enter the same **household code** (at least 6
   characters) and tap Save. That's it – no accounts.

How it works: sessions are always saved on the phone first and pushed when there is a connection
(after finishing a workout, when the app opens, when it comes back online, or via "Sync now").
Both profiles' history ends up on both phones.

Security note: the tables have Row Level Security on with no policies, so the public key cannot
read them directly. The app only calls two SQL functions that require the household code – anyone
who knows your project URL, anon key *and* household code could read or write your gym log, so
pick a code that isn't guessable.

## Behaviour notes

- Machine and video links open in an in-app bottom sheet. Close it by swiping the header down,
  tapping outside, ✕, or the Android back button (which closes the sheet, not the app).
- Videos need a connection; everything else works offline after the first load.
- The rest timer starts after each ticked set and vibrates + beeps at the end. Vibration needs
  Android Chrome; the screen must stay on for the timer to alert you.
- Weight logging is off by default; turn it on per profile in Settings.
- Streak = consecutive weeks (Mon–Sun) with at least one finished session.
