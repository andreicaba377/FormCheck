import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { store, type ExerciseId, type Session } from './store.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const EXERCISES: ExerciseId[] = ['squat', 'deadlift', 'pushup', 'pullup'];
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/sessions', (req, res) => {
  const ex = req.query.exercise as string | undefined;
  const list = store.all().filter((s) => !ex || s.exercise === ex);
  res.json(list);
});

app.post('/api/sessions', (req, res) => {
  const b = req.body ?? {};
  if (!EXERCISES.includes(b.exercise)) return res.status(400).json({ error: 'Invalid exercise' });
  const reps = Array.isArray(b.repDetails) ? b.repDetails.slice(0, 500) : [];
  if (reps.length === 0) return res.status(400).json({ error: 'A session needs at least one rep' });

  const repDetails = reps.map((r: any, i: number) => ({
    n: i + 1,
    score: Math.max(0, Math.min(100, Math.round(num(r.score)))),
    issues: Array.isArray(r.issues) ? r.issues.map(String).slice(0, 6) : [],
    depth: Math.round(num(r.depth)),
  }));
  const scores = repDetails.map((r: { score: number }) => r.score);
  const issues: Record<string, number> = {};
  for (const r of repDetails) for (const i of r.issues) issues[i] = (issues[i] ?? 0) + 1;

  const session: Session = {
    id: randomUUID(),
    exercise: b.exercise,
    createdAt: new Date().toISOString(),
    durationSec: Math.max(0, Math.round(num(b.durationSec))),
    reps: repDetails.length,
    avgScore: Math.round(scores.reduce((a: number, c: number) => a + c, 0) / scores.length),
    bestScore: Math.max(...scores),
    issues,
    repDetails,
  };
  res.status(201).json(store.add(session));
});

app.delete('/api/sessions/:id', (req, res) => {
  store.remove(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
});

app.delete('/api/sessions', (_req, res) => {
  store.clear();
  res.json({ ok: true });
});

app.get('/api/stats', (_req, res) => {
  const list = store.all();
  const totalReps = list.reduce((a, s) => a + s.reps, 0);
  const totalSec = list.reduce((a, s) => a + s.durationSec, 0);
  const avgScore = list.length ? Math.round(list.reduce((a, s) => a + s.avgScore * s.reps, 0) / Math.max(1, totalReps)) : 0;

  const byExercise = EXERCISES.map((id) => {
    const l = list.filter((s) => s.exercise === id);
    const reps = l.reduce((a, s) => a + s.reps, 0);
    return {
      exercise: id,
      sessions: l.length,
      reps,
      avgScore: reps ? Math.round(l.reduce((a, s) => a + s.avgScore * s.reps, 0) / reps) : 0,
      best: l.length ? Math.max(...l.map((s) => s.bestScore)) : 0,
    };
  });

  const issues: Record<string, number> = {};
  for (const s of list) for (const [k, v] of Object.entries(s.issues)) issues[k] = (issues[k] ?? 0) + v;
  const topIssues = Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([issue, count]) => ({ issue, count }));

  // streak of consecutive days with a session
  const days = new Set(list.map((s) => s.createdAt.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  res.json({ sessions: list.length, totalReps, totalSec, avgScore, streak, byExercise, topIssues });
});

// Serve built frontend in production
const dist = resolve(import.meta.dirname, '../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => console.log(`FormCheck API on http://localhost:${PORT}`));
