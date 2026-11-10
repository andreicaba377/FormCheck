import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type ExerciseId = 'squat' | 'deadlift' | 'pushup' | 'pullup';

export interface RepRecord {
  n: number;
  score: number;
  issues: string[];
  depth: number; // min key-joint angle reached (deg)
}

export interface Session {
  id: string;
  exercise: ExerciseId;
  createdAt: string;
  durationSec: number;
  reps: number;
  avgScore: number;
  bestScore: number;
  issues: Record<string, number>;
  repDetails: RepRecord[];
}

const FILE = resolve(import.meta.dirname, '../data/sessions.json');

function load(): Session[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, 'utf8')) as Session[];
  } catch {
    return [];
  }
}

function save(list: Session[]) {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(list, null, 2));
  renameSync(tmp, FILE);
}

export const store = {
  all: () => load().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  add(s: Session) {
    const list = load();
    list.push(s);
    save(list);
    return s;
  },
  remove(id: string) {
    const list = load();
    const next = list.filter((s) => s.id !== id);
    save(next);
    return next.length !== list.length;
  },
  clear: () => save([]),
};
