import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, FileVideo, Loader2, Square, Volume2, VolumeX, AlertTriangle, Timer, Trophy, Zap,
} from 'lucide-react';
import { EXERCISES, RepEngine } from '../pose/exercises';
import { BODY_POINTS, SKELETON, type Landmark } from '../pose/geometry';
import { loadLandmarker } from '../pose/landmarker';
import { api } from '../api';
import type { ExerciseId, RepRecord, Session } from '../types';
import { EXERCISE_META } from './meta';
import ScoreRing from './ScoreRing';

type Status = 'idle' | 'loading' | 'countdown' | 'running' | 'error';
const TARGETS = [0, 5, 8, 10, 12, 15, 20];

const GOOD = '#c6ff3d';
const BAD = '#ff4a1c';

export default function Trainer({ onViewProgress }: { onViewProgress: () => void }) {
  const [exercise, setExercise] = useState<ExerciseId>('squat');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [reps, setReps] = useState<RepRecord[]>([]);
  const [hint, setHint] = useState('');
  const [tracking, setTracking] = useState(false);
  const [phase, setPhase] = useState<'up' | 'down'>('up');
  const [metric, setMetric] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [voice, setVoice] = useState(true);
  const [badLive, setBadLive] = useState(false);
  const [summary, setSummary] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);
  const [aspect, setAspect] = useState(4 / 3);
  const [fileMode, setFileMode] = useState(false);
  const [target, setTarget] = useState(0);
  const [count, setCount] = useState(3);
  const targetRef = useRef(0);
  const mountedRef = useRef(true);
  const finishedRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RepEngine>(new RepEngine('squat'));
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const repsRef = useRef<RepRecord[]>([]);
  const voiceRef = useRef(voice);
  const lastUiRef = useRef(0);
  const lastTsRef = useRef(-1);
  const fileUrlRef = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  voiceRef.current = voice;
  targetRef.current = target;
  const meta = EXERCISE_META[exercise];
  const cfg = EXERCISES[exercise];

  const speak = useCallback((text: string) => {
    if (!voiceRef.current || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    window.speechSynthesis.speak(u);
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute('src');
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopLoop();
    };
  }, [stopLoop]);

  const draw = (lm: Landmark[] | null, bad: Set<number>) => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== v.videoWidth) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!lm) return;
    const px = (i: number) => ({ x: lm[i].x * c.width, y: lm[i].y * c.height });
    const ok = (i: number) => (lm[i]?.visibility ?? 0) > 0.4;
    const scale = c.width / 640;

    ctx.lineCap = 'round';
    for (const [a, b] of SKELETON) {
      if (!ok(a) || !ok(b)) continue;
      const isBad = bad.has(a) || bad.has(b);
      const pa = px(a);
      const pb = px(b);
      ctx.strokeStyle = isBad ? BAD : GOOD;
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const i of BODY_POINTS) {
      if (!ok(i)) continue;
      const p = px(i);
      const isBad = bad.has(i);
      ctx.fillStyle = '#161513';
      ctx.beginPath();
      ctx.arc(p.x, p.y, (isBad ? 8 : 5.5) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isBad ? BAD : GOOD;
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      if (isBad) {
        ctx.setLineDash([5 * scale, 4 * scale]);
        ctx.strokeStyle = BAD;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const loop = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    const landmarker = await loadLandmarker();
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (v.readyState < 2 || v.videoWidth === 0) return;
      const ts = performance.now();
      if (ts <= lastTsRef.current) return;
      lastTsRef.current = ts;

      const res = landmarker.detectForVideo(v, ts);
      const lm = (res.landmarks[0] as Landmark[] | undefined) ?? null;
      const out = engineRef.current.process(lm, v.videoWidth / v.videoHeight, ts);
      draw(out.tracking ? lm : null, out.badJoints);

      if (out.rep) {
        const rep = out.rep;
        repsRef.current = [...repsRef.current, rep];
        setReps(repsRef.current);
        const hit = targetRef.current > 0 && repsRef.current.length >= targetRef.current;
        speak(hit ? 'Target reached' : rep.issues.length ? `${rep.n}. ${rep.issues[0]}` : `${rep.n}`);
        if (hit) setTimeout(() => finishRef.current(), 900);
      }
      if (ts - lastUiRef.current > 90 || out.rep) {
        lastUiRef.current = ts;
        setTracking(out.tracking);
        setPhase(out.phase);
        setMetric(out.metric);
        setHint(out.hint);
        setBadLive(out.live.length > 0);
        setElapsed(Math.floor((ts - startRef.current) / 1000));
      }
    };
    tick();
  }, [speak]);

  const begin = async (file?: File) => {
    setError('');
    setSummary(null);
    setStatus('loading');
    engineRef.current = new RepEngine(exercise);
    repsRef.current = [];
    setReps([]);
    setElapsed(0);
    setFileMode(!!file);
    try {
      const v = videoRef.current!;
      if (file) {
        fileUrlRef.current = URL.createObjectURL(file);
        v.src = fileUrlRef.current;
        v.loop = true;
      } else {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API not available (use https or localhost).');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        v.srcObject = stream;
      }
      v.muted = true;
      v.playsInline = true;
      await v.play();
      setAspect(v.videoWidth / v.videoHeight || 4 / 3);
      await loadLandmarker();
      setStatus('countdown');
      for (let n = 3; n > 0; n--) {
        setCount(n);
        speak(String(n));
        await new Promise((r) => setTimeout(r, 1000));
        if (!mountedRef.current) return;
      }
      finishedRef.current = false;
      startRef.current = performance.now();
      lastTsRef.current = -1;
      setStatus('running');
      speak(`${meta.name} tracking started`);
      loop();
    } catch (e) {
      stopLoop();
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const finish = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const duration = Math.max(1, Math.round((performance.now() - startRef.current) / 1000));
    const done = repsRef.current;
    stopLoop();
    window.speechSynthesis?.cancel();
    setStatus('idle');
    if (done.length === 0) return;
    setSaving(true);
    try {
      setSummary(await api.save({ exercise, durationSec: duration, repDetails: done }));
    } catch (e) {
      setError('Could not save session: ' + (e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  finishRef.current = finish;
  const running = status === 'running';
  const avg = reps.length ? Math.round(reps.reduce((a, r) => a + r.score, 0) / reps.length) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="trainer">
      <section className="stage-col">
        <div className="exercise-picker">
          {(Object.keys(EXERCISE_META) as ExerciseId[]).map((id, idx) => {
            const m = EXERCISE_META[id];
            return (
              <button
                key={id}
                className={`ex-card ${exercise === id ? 'sel' : ''}`}
                disabled={status === 'running' || status === 'loading' || status === 'countdown'}
                onClick={() => setExercise(id)}
              >
                <span className="ex-num">0{idx + 1}</span>
                <span className="ex-name">{m.name}</span>
                <span className="ex-desc">{m.short}</span>
              </button>
            );
          })}
        </div>

        <div className={`stage ${running ? 'live' : ''} ${badLive ? 'alert' : ''}`} style={{ aspectRatio: String(aspect) }}>
          <video ref={videoRef} className={fileMode ? '' : 'mirror'} playsInline muted />
          <canvas ref={canvasRef} className={fileMode ? '' : 'mirror'} />

          {status === 'countdown' && (
            <div className="countdown" key={count}>
              <span>{count}</span>
              <p>Get into position</p>
            </div>
          )}

          {(status === 'idle' || status === 'loading' || status === 'error') && (
            <div className="stage-overlay">
              {status === 'loading' ? (
                <>
                  <Loader2 className="spin" size={44} />
                  <h3>Loading pose model…</h3>
                  <p>Allow camera access if your browser asks.</p>
                </>
              ) : (
                <>
                  <div className="overlay-icon">
                    <Camera size={38} />
                  </div>
                  <h3>Ready to check your {meta.name.toLowerCase()}?</h3>
                  <p>{cfg.cue}</p>
                  <div className="overlay-actions">
                    <button className="btn primary big" onClick={() => begin()}>
                      <Camera size={18} /> Start camera
                    </button>
                    <button className="btn ghost" onClick={() => fileInput.current?.click()}>
                      <FileVideo size={16} /> Use a video
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="video/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) begin(f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {running && (
            <>
              <div className="hud-top">
                <span className="chip"><Timer size={14} /> {mm}:{ss}</span>
                <span className={`chip ${tracking ? 'ok' : 'warn'}`}>
                  <span className="dot" /> {tracking ? 'Tracking' : 'Searching…'}
                </span>
              </div>
              <div className="hud-reps">
                <div className="reps-num" key={reps.length}>{reps.length}</div>
                <div className="reps-label">REPS{target ? ` / ${target}` : ''}</div>
              </div>
              <div className={`hud-hint ${badLive ? 'bad' : tracking ? 'good' : 'warn'}`}>
                {badLive ? <AlertTriangle size={18} /> : tracking ? <Zap size={18} /> : <Loader2 size={18} className="spin" />}
                {hint}
              </div>
            </>
          )}
        </div>

        {error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}

        <div className="controls">
          <div className="ctl-group">
            <button className="btn icon" onClick={() => setVoice((v) => !v)} title="Voice coaching">
              {voice ? <Volume2 size={18} /> : <VolumeX size={18} />} Voice {voice ? 'on' : 'off'}
            </button>
            <label className="target-pick">
              <span>Goal</span>
              <select value={target} disabled={status !== 'idle' && status !== 'error'} onChange={(e) => setTarget(Number(e.target.value))}>
                {TARGETS.map((t) => (
                  <option key={t} value={t}>{t === 0 ? 'Open set' : `${t} reps`}</option>
                ))}
              </select>
            </label>
          </div>
          {running && (
            <button className="btn danger" onClick={finish}>
              <Square size={16} fill="currentColor" /> Finish set
            </button>
          )}
        </div>
      </section>

      <aside className="side-col">
        <div className="panel gauge-panel">
          <ScoreRing value={avg} label="Avg form" empty={reps.length === 0} />
          <div className="gauge-meta">
            <div>
              <span className="k">{cfg.metricLabel}</span>
              <span className="v">{running && tracking ? `${Math.round(metric)}°` : '–'}</span>
            </div>
            <div>
              <span className="k">Phase</span>
              <span className={`v phase ${phase}`}>{running && tracking ? (phase === 'down' ? 'Descending' : 'Top') : '–'}</span>
            </div>
          </div>
        </div>

        <div className="panel log-panel">
          <div className="panel-title">
            <Trophy size={16} /> Rep log
            <span className="count">{reps.length}</span>
          </div>
          {reps.length === 0 ? (
            <div className="empty-small">Reps will appear here with a form score each.</div>
          ) : (
            <ul className="rep-list">
              {[...reps].reverse().map((r) => (
                <li key={r.n} className="rep-item">
                  <span className={`badge ${r.score >= 85 ? 'g' : r.score >= 60 ? 'y' : 'r'}`}>{r.score}</span>
                  <div>
                    <div className="rep-title">Rep {r.n} <small>· {r.depth}° depth</small></div>
                    <div className="rep-issues">
                      {r.issues.length ? r.issues.map((i) => <em key={i}>{i}</em>) : <span className="clean">Clean rep ✓</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel tips">
          <div className="panel-title">Tips</div>
          <ul>
            {meta.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </aside>

      {(saving || summary) && (
        <div className="modal-back" onClick={() => !saving && setSummary(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {saving || !summary ? (
              <><Loader2 className="spin" size={36} /><p>Saving your set…</p></>
            ) : (
              <>
                <CheckCircle2 size={44} className="ok-icon" />
                <h2>Set complete!</h2>
                <p className="muted">{EXERCISES[summary.exercise].name} · saved to your history</p>
                <div className="sum-grid">
                  <div><b>{summary.reps}</b><span>Reps</span></div>
                  <div><b>{summary.avgScore}</b><span>Avg score</span></div>
                  <div><b>{summary.bestScore}</b><span>Best rep</span></div>
                  <div><b>{summary.durationSec}s</b><span>Time</span></div>
                </div>
                {Object.keys(summary.issues).length > 0 && (
                  <div className="sum-issues">
                    <div className="k">Fix next time</div>
                    {Object.entries(summary.issues).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                      <div key={k} className="issue-row"><span>{k}</span><b>{n}×</b></div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setSummary(null)}>New set</button>
                  <button className="btn primary" onClick={onViewProgress}>View progress</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
