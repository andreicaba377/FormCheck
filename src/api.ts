import type { RepRecord, Session, Stats, ExerciseId } from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export const api = {
  sessions: () => req<Session[]>('/api/sessions'),
  stats: () => req<Stats>('/api/stats'),
  save: (body: { exercise: ExerciseId; durationSec: number; repDetails: RepRecord[] }) =>
    req<Session>('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => req<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),
  clear: () => req<{ ok: true }>('/api/sessions', { method: 'DELETE' }),
};
