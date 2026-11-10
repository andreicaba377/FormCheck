import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Clock, Download, Flame, Layers, Loader2, Target, Trash2, TrendingUp } from 'lucide-react';
import { api } from '../api';
import type { ExerciseId, Session, Stats } from '../types';

const dayKey = (d: Date) => d.toLocaleDateString('sv');

function Heatmap({ sessions }: { sessions: Session[] }) {
  const perDay = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.createdAt));
    perDay.set(k, (perDay.get(k) ?? 0) + s.reps);
  }
  const today = new Date();
  today.setHours(12);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 14 * 7); // Monday, 15 weeks back
  const cells: { k: string; n: number; future: boolean }[] = [];
  for (let d = new Date(start); d <= today || cells.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    cells.push({ k, n: perDay.get(k) ?? 0, future: d > today });
  }
  const lvl = (n: number) => (n === 0 ? '' : n < 6 ? 'l1' : n < 12 ? 'l2' : n < 25 ? 'l3' : 'l4');
  return (
    <>
      <div className="heat">
        {cells.map((c) => (
          <i key={c.k} className={lvl(c.n)} style={c.future ? { visibility: 'hidden' } : undefined} title={`${c.k}: ${c.n} reps`} />
        ))}
      </div>
      <div className="heat-legend"><span>15 weeks</span><span>darker = more reps</span></div>
    </>
  );
}

function exportCsv(sessions: Session[]) {
  const rows = [['date', 'exercise', 'reps', 'avg_score', 'best_score', 'duration_sec', 'issues']];
  for (const s of sessions)
    rows.push([s.createdAt, s.exercise, String(s.reps), String(s.avgScore), String(s.bestScore), String(s.durationSec),
      '"' + Object.entries(s.issues).map(([k, n]) => `${k} x${n}`).join('; ') + '"']);
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formcheck-sessions.csv';
  a.click();
  URL.revokeObjectURL(url);
}
import { EXERCISE_META } from './meta';
import { scoreColor } from './ScoreRing';

function LineChart({ sessions }: { sessions: Session[] }) {
  const data = [...sessions].reverse().slice(-20);
  if (data.length < 2)
    return <div className="empty-small">Complete at least 2 sets to see your form trend.</div>;
  const W = 640, H = 200, P = 28;
  const x = (i: number) => P + (i * (W - 2 * P)) / (data.length - 1);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const line = data.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.avgScore)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#d6d1c4" strokeDasharray={g === 0 ? '' : '2 4'} />
          <text x={4} y={y(g) + 4} fill="#77736a" fontSize="11" fontFamily="JetBrains Mono, monospace">{g}</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="#161513" strokeWidth="2" strokeLinejoin="round" />
      {data.map((s, i) => (
        <circle key={s.id} cx={x(i)} cy={y(s.avgScore)} r="5.5" fill={EXERCISE_META[s.exercise].color} stroke="#faf8f2" strokeWidth="2">
          <title>{`${EXERCISE_META[s.exercise].name}: ${s.avgScore} (${new Date(s.createdAt).toLocaleDateString()})`}</title>
        </circle>
      ))}
    </svg>
  );
}

const fmtTime = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)}h` : s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`);

export default function Progress() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<ExerciseId | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([api.sessions(), api.stats()]);
      setSessions(s);
      setStats(st);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="error-box">Could not reach the API: {err}</div>;
  if (!sessions || !stats) return <div className="center"><Loader2 className="spin" size={36} /></div>;

  if (sessions.length === 0)
    return (
      <div className="panel empty-big">
        <TrendingUp size={46} />
        <h3>No sets yet</h3>
        <p>Do your first set in the Train tab and your progress will show up here.</p>
      </div>
    );

  const kpis = [
    { icon: <Layers size={18} />, label: 'Sets', value: stats.sessions },
    { icon: <Target size={18} />, label: 'Total reps', value: stats.totalReps },
    { icon: <TrendingUp size={18} />, label: 'Avg form', value: stats.avgScore },
    { icon: <Flame size={18} />, label: 'Day streak', value: stats.streak },
    { icon: <Clock size={18} />, label: 'Time trained', value: fmtTime(stats.totalSec) },
  ];

  return (
    <div className="progress">
      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi panel" key={k.label}>
            <div className="kpi-icon">{k.icon}</div>
            <b>{k.value}</b>
            <span>{k.label}</span>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><TrendingUp size={16} /> Form score trend</div>
          <LineChart sessions={sessions} />
        </div>
        <div className="panel">
          <div className="panel-title"><Target size={16} /> By exercise</div>
          <div className="by-ex">
            {stats.byExercise.map((e) => {
              const m = EXERCISE_META[e.exercise];
              return (
                <div key={e.exercise} className="by-row">
                  <div className="by-head">
                    <span>{m.name}</span>
                    <small>{e.reps} reps · {e.sessions} sets</small>
                  </div>
                  <div className="bar"><i style={{ width: `${e.avgScore}%`, background: m.color }} /></div>
                  <div className="by-foot"><span>avg {e.avgScore || '–'}</span><span>best {e.best || '–'}</span></div>
                </div>
              );
            })}
          </div>
          {stats.topIssues.length > 0 && (
            <>
              <div className="panel-title" style={{ marginTop: 18 }}>Most common faults</div>
              {stats.topIssues.map((i) => (
                <div key={i.issue} className="issue-row"><span>{i.issue}</span><b>{i.count}×</b></div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><Flame size={16} /> Activity</div>
          <Heatmap sessions={sessions} />
        </div>
        <div className="panel">
          <div className="panel-title"><Target size={16} /> Personal bests</div>
          {(Object.keys(EXERCISE_META) as ExerciseId[]).map((id) => {
            const l = sessions.filter((s) => s.exercise === id);
            return (
              <div className="pr-row" key={id}>
                <b>{EXERCISE_META[id].name}</b>
                <small>
                  {l.length ? `${Math.max(...l.map((s) => s.reps))} reps/set · best rep ${Math.max(...l.map((s) => s.bestScore))}` : 'no data'}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title between">
          <span>History</span>
          <div className="filters">
            {(['all', ...Object.keys(EXERCISE_META)] as (ExerciseId | 'all')[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : EXERCISE_META[f].code}
              </button>
            ))}
            <button onClick={() => exportCsv(sessions)} title="Export CSV"><Download size={11} style={{ verticalAlign: -1 }} /> CSV</button>
            <button
              onClick={async () => {
                if (confirm('Delete all saved sets?')) {
                  await api.clear();
                  load();
                }
              }}
            >
              <Trash2 size={11} style={{ verticalAlign: -1 }} /> Clear
            </button>
          </div>
        </div>
        <ul className="history">
          {sessions.filter((s) => filter === 'all' || s.exercise === filter).map((s) => {
            const m = EXERCISE_META[s.exercise];
            const isOpen = open === s.id;
            return (
              <li key={s.id}>
                <div className="hist-row" onClick={() => setOpen(isOpen ? null : s.id)}>
                  <span className="hist-tag" style={{ background: m.color }}>{m.code}</span>
                  <div className="hist-main">
                    <b>{m.name}</b>
                    <small>{new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>
                  </div>
                  <div className="hist-stat"><b>{s.reps}</b><small>reps</small></div>
                  <div className="hist-stat"><b style={{ color: scoreColor(s.avgScore) }}>{s.avgScore}</b><small>form</small></div>
                  <button
                    className="btn tiny icon-only"
                    title="Delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await api.remove(s.id);
                      load();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={18} className={`chev ${isOpen ? 'up' : ''}`} />
                </div>
                {isOpen && (
                  <div className="hist-detail">
                    <div className="mini-bars">
                      {s.repDetails.map((r) => (
                        <div key={r.n} className="mini" title={`Rep ${r.n}: ${r.score}${r.issues.length ? ' – ' + r.issues.join(', ') : ''}`}>
                          <i style={{ height: `${Math.max(6, r.score)}%`, background: scoreColor(r.score) }} />
                          <span>{r.n}</span>
                        </div>
                      ))}
                    </div>
                    {Object.keys(s.issues).length > 0 && (
                      <div className="rep-issues">
                        {Object.entries(s.issues).map(([k, n]) => <em key={k}>{k} ×{n}</em>)}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
