# Gym Tracker – Mohammed & Mai

A mobile-first PWA for following and tracking the 3-day gym plan at Gold's Gym (gym80 machines).
Arabic (RTL, default) and English, green palette, automatic dark mode, works offline.

- **Home** – profile switcher, today's suggested day, this week's progress, streak
- **Week** – schedule, training rules, useful German gym words
- **Workout** – exercises by muscle group, set ticks, optional 60/90 s rest timer, machine and video popups
- **History** – per-profile calendar and list of finished sessions
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

For sync, add the three `VITE_FIREBASE_*` values (see below) as environment variables on the host
(Vercel/Netlify: project settings → Environment variables; GitHub Pages: repo
*Settings → Secrets and variables → Actions → Variables*), then redeploy.

On the phone: open the site in Chrome → menu → **Add to Home screen / Install app**.

## Sync between two phones (Firebase, optional)

Without Firebase the app works fully, storing everything on the phone (IndexedDB).
To share history between both phones:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project
   (Google Analytics is not needed).
2. **Build → Firestore Database → Create database.** Choose a European location
   (e.g. `eur3` or `europe-west3`) and start in **production mode**.
3. Open the **Rules** tab, replace everything with the contents of
   [`firestore.rules`](firestore.rules), and click **Publish**.
4. The project's web config (`apiKey`, `projectId`, `appId`) is already built into
   `src/sync.ts`, so there is nothing to configure on the host. To point the app at a different
   Firebase project, set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` and
   `VITE_FIREBASE_APP_ID` (see `.env.example`) and redeploy.
5. On each phone open ⚙ **Settings → Sync**, enter the same **household code** (at least 6
   characters) and tap Save. That's it – no accounts.

How it works: sessions are always saved on the phone first and pushed when there is a connection
(after finishing a workout, when the app opens, when it comes back online, or via "Sync now").
Both profiles' history ends up on both phones.

Data layout in Firestore: `households/{code}/profiles/{mohammed|mai}` and
`households/{code}/sessions/{id}` (each session document contains its set logs).

Security note: there are no accounts, so the household code is the only secret. The rules let
anyone who knows the code read and write that household's gym log, and nobody can list the codes.
The Firebase web `apiKey` is not a secret (it is visible in every Firebase web app), so the
protection is the code – pick one that isn't guessable. The free "Spark" plan is far more than two
people need.
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
- Weight logging is off by default; turn it on per profile in Settings.
- Streak = consecutive weeks (Mon–Sun) with at least one finished session.
