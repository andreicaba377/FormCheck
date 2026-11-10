import type { ExerciseId } from '../types';

export const EXERCISE_META: Record<
  ExerciseId,
  { name: string; code: string; color: string; short: string; tips: string[] }
> = {
  squat: {
    name: 'Squat',
    code: 'SQ',
    color: '#e8431a',
    short: 'Depth, knee tracking',
    tips: ['Hips below knee level = full depth', 'Push knees out over your toes', 'Keep the chest proud'],
  },
  deadlift: {
    name: 'Deadlift',
    code: 'DL',
    color: '#161513',
    short: 'Hip hinge, lockout',
    tips: ['Film from the side', 'Hinge at the hips, not the knees', 'Finish by standing fully tall'],
  },
  pushup: {
    name: 'Push-up',
    code: 'PU',
    color: '#2f6fa8',
    short: 'Depth, body line',
    tips: ['Film from the side, full body in frame', 'Chest to the floor, elbows ~90°', 'Keep hips in line with shoulders'],
  },
  pullup: {
    name: 'Pull-up',
    code: 'PL',
    color: '#6b7a1f',
    short: 'Range, swing',
    tips: ['Start from a full dead hang', 'Pull until your chin clears the bar', 'Avoid swinging or kipping'],
  },
};
