export type ExerciseId = 'squat' | 'deadlift' | 'pushup' | 'pullup';

export interface RepRecord {
  n: number;
  score: number;
  issues: string[];
  depth: number;
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

export interface Stats {
  sessions: number;
  totalReps: number;
  totalSec: number;
  avgScore: number;
  streak: number;
  byExercise: { exercise: ExerciseId; sessions: number; reps: number; avgScore: number; best: number }[];
  topIssues: { issue: string; count: number }[];
}
