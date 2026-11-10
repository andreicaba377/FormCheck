# FormCheck

An AI form coach that runs in your browser. Point your camera at yourself during a squat, deadlift, push-up or pull-up and it counts reps, scores each one (0–100) and flags form problems in real time. Your sessions are saved by a small Express API so you can track progress over time.

Pose estimation (MediaPipe) runs entirely on your device. Video is never uploaded.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [How to use it](#how-to-use-it)
- [Supported exercises](#supported-exercises)
- [How detection works](#how-detection-works)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Troubleshooting](#troubleshooting)

## Features

**Training**
- Live skeleton overlay on camera or an uploaded video; joints turn red when form is off.
- Automatic rep counting with a form score per rep.
- 3-2-1 countdown before tracking starts.
- Optional rep goal (5–20) that ends and saves the set automatically.
- Live feedback text and optional voice cues.

**Progress**
- Totals: sets, reps, average form, day streak, time trained.
- Form score trend chart and per-exercise averages.
- 15-week activity heatmap and personal bests.
- Most common faults.
- History with per-rep breakdown, filter by exercise, delete, and CSV export.

**UI**
- Paper-and-ink editorial theme, responsive down to phone width.
- Clicking the FormCheck logo returns to the main menu.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install     # also copies the MediaPipe WASM files and downloads the pose model
npm run dev     # web app on http://localhost:5173, API on http://localhost:3001
```

Production build, served entirely by Express:

```bash
npm run build
npm start       # http://localhost:3001
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server and API with auto-reload |
| `npm run build` | Typecheck, then build the frontend into `dist/` |
| `npm start` | Run the API and serve `dist/` |
| `npm run typecheck` | TypeScript check only |

## How to use it

1. Open the **Train** tab and pick an exercise.
2. Optionally set a rep goal.
3. Click **Start camera** (or **Use a video**) and allow camera access.
4. Get into position during the countdown. Make sure your whole body is in frame.
5. Do your reps, then click **Finish set** (or reach your goal). The set is saved automatically.
6. Open **Progress** to review your history.

Important: select the right exercise *before* starting, including when you upload a video. The counter measures the joints of the selected exercise, so a pull-up video analysed as a squat will count nothing.

The camera needs `localhost` or HTTPS.

## Supported exercises

| Exercise | Camera angle | Rep is counted from | Faults detected |
| --- | --- | --- | --- |
| Squat | Front or side | Knee angle | Shallow depth, knees caving in, chest falling forward |
| Deadlift | Side | Hip angle | Not hinging at the hips, too much knee bend, incomplete lockout |
| Push-up | Side | Elbow angle | Not low enough, hips sagging or piking |
| Pull-up | Front or side | Elbow angle | Chin not over the bar, swinging / kipping |

## How detection works

1. **MediaPipe Pose Landmarker** returns 33 body landmarks per video frame.
2. The app picks the body side that is most visible and computes the key joint angle with aspect-ratio correction, smoothed with an exponential moving average.
3. A small state machine ([`RepEngine`](src/pose/exercises.ts)) counts a rep when the angle leaves the "up" position, reaches the bottom, and returns.
4. While a rep is in progress, per-frame checks (for example knee width versus ankle width) collect form issues. Each rep starts at 100 and loses points per issue.

Each exercise is a config object in [`src/pose/exercises.ts`](src/pose/exercises.ts) with `startThr`, `endThr` and `minDrop` thresholds. If reps are missed or double-counted for your body or camera setup, adjust those values.

## API reference

Base URL: `http://localhost:3001`. Data is stored in `data/sessions.json`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/sessions` | List sessions, newest first. Optional `?exercise=squat` |
| `POST` | `/api/sessions` | Save a session |
| `DELETE` | `/api/sessions/:id` | Delete one session |
| `DELETE` | `/api/sessions` | Delete all sessions |
| `GET` | `/api/stats` | Totals, streak, per-exercise stats, top faults |

`POST /api/sessions` body:

```json
{
  "exercise": "squat",
  "durationSec": 42,
  "repDetails": [
    { "score": 95, "issues": [], "depth": 88 },
    { "score": 60, "issues": ["Shallow depth"], "depth": 112 }
  ]
}
```

`exercise` is one of `squat`, `deadlift`, `pushup`, `pullup`. The server validates input and computes `reps`, `avgScore`, `bestScore` and the issue counts.

## Project structure

```
FormCheck/
├── server/
│   ├── index.ts          Express API, also serves dist/ in production
│   └── store.ts          JSON file storage
├── src/
│   ├── pose/
│   │   ├── landmarker.ts MediaPipe loading (local files, CDN fallback)
│   │   ├── geometry.ts   Angles, smoothing, landmark indices
│   │   └── exercises.ts  Exercise configs and the rep-counting engine
│   ├── components/
│   │   ├── Trainer.tsx   Camera, overlay, HUD, set summary
│   │   ├── Progress.tsx  Stats, charts, heatmap, history
│   │   ├── ScoreRing.tsx
│   │   └── meta.ts       Exercise names, colors, tips
│   ├── App.tsx
│   ├── api.ts            Frontend API client
│   ├── types.ts
│   └── styles.css
├── scripts/setup-assets.mjs   Copies WASM, downloads the pose model
├── public/mediapipe/          Generated by the script above
└── data/sessions.json         Saved sessions (created on first save)
```

## Tech stack

TypeScript, React 18, Vite, MediaPipe Tasks Vision, Express, lucide-react. No database and no charting library: storage is a JSON file and charts are plain SVG.

## Troubleshooting

- **Progress shows "Could not reach the API":** the API on port 3001 is not running. Start everything with `npm run dev`.
- **Camera does not start:** use `http://localhost` or HTTPS, and check browser camera permissions.
- **Nothing is counted:** confirm the right exercise is selected, your whole body is visible, and the camera angle matches the table above.
- **Pose model fails to load:** `npm install` downloads it into `public/mediapipe/`. If that failed (offline), the app falls back to the CDN, which needs internet access.
- **Slow on very large videos:** 4K files are heavy to decode. A 720p or 1080p clip tracks more smoothly.
