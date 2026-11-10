import { Ema, LM, angle, dist, fromVertical, type Landmark, type Pt } from './geometry';
import type { ExerciseId, RepRecord } from '../types';

export interface Issue {
  key: string;
  joints: number[];
  /** score penalty */
  penalty: number;
}

interface Ctx {
  /** landmark point in aspect-corrected space */
  p: (i: number) => Pt;
  vis: (i: number) => number;
  /** side-dependent landmark indices */
  s: { sh: number; el: number; wr: number; hp: number; kn: number; an: number };
}

interface Config {
  id: ExerciseId;
  name: string;
  /** leaving the "up" position when metric falls below this */
  startThr: number;
  /** rep completes when metric rises above this */
  endThr: number;
  /** reps whose lowest metric never goes below this are ignored as wiggles */
  minDrop: number;
  /** landmarks that must be visible */
  required: (s: Ctx['s']) => number[];
  metric: (c: Ctx) => number;
  frameChecks: (c: Ctx, metric: number) => Issue[];
  repChecks: (minMetric: number) => Issue[];
  cue: string;
  metricLabel: string;
}

type Side = Ctx['s'];
const L: Side = { sh: LM.L_SHOULDER, el: LM.L_ELBOW, wr: LM.L_WRIST, hp: LM.L_HIP, kn: LM.L_KNEE, an: LM.L_ANKLE };
const R: Side = { sh: LM.R_SHOULDER, el: LM.R_ELBOW, wr: LM.R_WRIST, hp: LM.R_HIP, kn: LM.R_KNEE, an: LM.R_ANKLE };

export const ISSUE = {
  shallow: 'Shallow depth',
  valgus: 'Knees caving in',
  lean: 'Chest falling forward',
  deadKnees: 'Too much knee bend',
  upright: 'Hinge more at the hips',
  lockout: 'Incomplete lockout',
  body: 'Hips sagging / piking',
  pushShallow: 'Not low enough',
  pullShort: 'Pull higher: chin over the bar',
  swing: 'Swinging / kipping',
} as const;

export const EXERCISES: Record<ExerciseId, Config> = {
  pullup: undefined as unknown as Config, // assigned below
  squat: {
    id: 'squat',
    name: 'Squat',
    startThr: 150,
    endThr: 160,
    minDrop: 135,
    metricLabel: 'Knee angle',
    cue: 'Stand sideways or facing the camera, full body in frame.',
    required: (s) => [s.sh, s.hp, s.kn, s.an],
    metric: (c) => angle(c.p(c.s.hp), c.p(c.s.kn), c.p(c.s.an)),
    frameChecks: (c, m) => {
      const out: Issue[] = [];
      // Knee valgus (front view): knees collapse inward relative to ankles
      const shW = dist(c.p(LM.L_SHOULDER), c.p(LM.R_SHOULDER));
      const torso = dist(c.p(c.s.sh), c.p(c.s.hp));
      const frontal = shW / Math.max(torso, 1e-6) > 0.55;
      if (
        frontal && m < 140 &&
        c.vis(LM.L_KNEE) > 0.5 && c.vis(LM.R_KNEE) > 0.5 &&
        c.vis(LM.L_ANKLE) > 0.5 && c.vis(LM.R_ANKLE) > 0.5
      ) {
        const kneeW = dist(c.p(LM.L_KNEE), c.p(LM.R_KNEE));
        const ankleW = dist(c.p(LM.L_ANKLE), c.p(LM.R_ANKLE));
        if (ankleW > 0 && kneeW / ankleW < 0.78)
          out.push({ key: ISSUE.valgus, joints: [LM.L_KNEE, LM.R_KNEE], penalty: 25 });
      }
      // Excessive forward lean (side view)
      if (!frontal && m < 130 && fromVertical(c.p(c.s.hp), c.p(c.s.sh)) > 60)
        out.push({ key: ISSUE.lean, joints: [c.s.sh, c.s.hp], penalty: 20 });
      return out;
    },
    repChecks: (min) =>
      min > 105 ? [{ key: ISSUE.shallow, joints: [], penalty: Math.min(35, 10 + (min - 105)) }] : [],
  },
  deadlift: {
    id: 'deadlift',
    name: 'Deadlift',
    startThr: 150,
    endThr: 165,
    minDrop: 140,
    metricLabel: 'Hip angle',
    cue: 'Stand sideways to the camera so we can see your hip hinge.',
    required: (s) => [s.sh, s.hp, s.kn, s.an],
    metric: (c) => angle(c.p(c.s.sh), c.p(c.s.hp), c.p(c.s.kn)),
    frameChecks: (c, m) => {
      const out: Issue[] = [];
      const knee = angle(c.p(c.s.hp), c.p(c.s.kn), c.p(c.s.an));
      if (m < 140 && knee < 95) out.push({ key: ISSUE.deadKnees, joints: [c.s.kn], penalty: 20 });
      if (m > 160 && knee < 160) out.push({ key: ISSUE.lockout, joints: [c.s.kn, c.s.hp], penalty: 15 });
      return out;
    },
    repChecks: (min) => (min > 125 ? [{ key: ISSUE.upright, joints: [], penalty: 20 }] : []),
  },
  pushup: {
    id: 'pushup',
    name: 'Push-up',
    startThr: 150,
    endThr: 160,
    minDrop: 130,
    metricLabel: 'Elbow angle',
    cue: 'Film from the side, with your whole body in frame.',
    required: (s) => [s.sh, s.el, s.wr, s.hp],
    metric: (c) => angle(c.p(c.s.sh), c.p(c.s.el), c.p(c.s.wr)),
    frameChecks: (c) => {
      const out: Issue[] = [];
      if (c.vis(c.s.an) > 0.4) {
        const body = angle(c.p(c.s.sh), c.p(c.s.hp), c.p(c.s.an));
        if (body < 158) out.push({ key: ISSUE.body, joints: [c.s.hp], penalty: 25 });
      }
      return out;
    },
    repChecks: (min) =>
      min > 95 ? [{ key: ISSUE.pushShallow, joints: [], penalty: Math.min(35, 10 + (min - 95)) }] : [],
  },
};

EXERCISES.pullup = {
  id: 'pullup',
  name: 'Pull-up',
  // Most people never fully lock out the arms between reps, so the "hang" thresholds are lenient.
  startThr: 125,
  endThr: 132,
  minDrop: 100,
  metricLabel: 'Elbow angle',
  cue: 'Face the camera or stand side-on, with the bar and your whole upper body in frame.',
  required: (s) => [s.sh, s.el, s.wr, s.hp],
  metric: (c) => angle(c.p(c.s.sh), c.p(c.s.el), c.p(c.s.wr)),
  frameChecks: (c, m) => {
    const out: Issue[] = [];
    if (m < 140 && fromVertical(c.p(c.s.hp), c.p(c.s.sh)) > 25)
      out.push({ key: ISSUE.swing, joints: [c.s.hp, c.s.sh], penalty: 20 });
    return out;
  },
  repChecks: (min) =>
    min > 80 ? [{ key: ISSUE.pullShort, joints: [], penalty: Math.min(35, 10 + (min - 80)) }] : [],
};

export interface EngineOutput {
  tracking: boolean;
  phase: 'up' | 'down';
  metric: number;
  live: Issue[];
  badJoints: Set<number>;
  rep?: RepRecord;
  hint: string;
}

const MIN_REP_MS = 500;
const FLAG_FRAMES = 4;

/** State machine: tracks one exercise, counts reps, collects form issues. */
export class RepEngine {
  private cfg: Config;
  private ema = new Ema(0.5);
  private side: Side = R;
  private phase: 'up' | 'down' = 'up';
  private repStart = 0;
  private minM = 999;
  private frameFlags = new Map<string, { n: number; issue: Issue }>();
  count = 0;

  constructor(id: ExerciseId) {
    this.cfg = EXERCISES[id];
  }

  reset() {
    this.ema.reset();
    this.phase = 'up';
    this.minM = 999;
    this.frameFlags.clear();
    this.count = 0;
  }

  private pickSide(lm: Landmark[]) {
    const score = (s: Side) => [s.sh, s.hp, s.kn, s.an].reduce((a, i) => a + (lm[i]?.visibility ?? 0), 0);
    const l = score(L);
    const r = score(R);
    const cur = this.side === L ? l : r;
    const other = this.side === L ? r : l;
    if (other > cur + 0.4) this.side = this.side === L ? R : L;
  }

  process(lm: Landmark[] | null, aspect: number, now: number): EngineOutput {
    const idle: EngineOutput = {
      tracking: false,
      phase: this.phase,
      metric: 0,
      live: [],
      badJoints: new Set(),
      hint: 'Step back until your whole body is visible',
    };
    if (!lm) return idle;
    this.pickSide(lm);

    const ctx: Ctx = {
      p: (i) => ({ x: lm[i].x * aspect, y: lm[i].y }),
      vis: (i) => lm[i]?.visibility ?? 0,
      s: this.side,
    };
    if (this.cfg.required(ctx.s).some((i) => ctx.vis(i) < 0.5)) {
      if (this.phase === 'down') {
        this.phase = 'up';
        this.frameFlags.clear();
      }
      return idle;
    }

    const m = this.ema.push(this.cfg.metric(ctx));
    const frameIssues = this.cfg.frameChecks(ctx, m);

    if (this.phase === 'up' && m < this.cfg.startThr) {
      this.phase = 'down';
      this.repStart = now;
      this.minM = m;
      this.frameFlags.clear();
    }

    let rep: RepRecord | undefined;
    if (this.phase === 'down') {
      this.minM = Math.min(this.minM, m);
      for (const iss of frameIssues) {
        const f = this.frameFlags.get(iss.key);
        this.frameFlags.set(iss.key, { n: (f?.n ?? 0) + 1, issue: iss });
      }
      if (m > this.cfg.endThr) {
        const valid = this.minM < this.cfg.minDrop && now - this.repStart > MIN_REP_MS;
        if (valid) rep = this.finishRep();
        this.phase = 'up';
        this.frameFlags.clear();
      }
    }

    const bad = new Set<number>();
    frameIssues.forEach((i) => i.joints.forEach((j) => bad.add(j)));

    let hint = this.phase === 'up' ? 'Ready: start your rep' : 'Go deeper, then drive up';
    if (frameIssues.length) hint = frameIssues[0].key;
    else if (this.phase === 'down' && m < this.cfg.minDrop - 15) hint = 'Good depth: drive up!';

    return { tracking: true, phase: this.phase, metric: m, live: frameIssues, badJoints: bad, rep, hint };
  }

  private finishRep(): RepRecord {
    const issues: Issue[] = [];
    for (const { n, issue } of this.frameFlags.values()) if (n >= FLAG_FRAMES) issues.push(issue);
    issues.push(...this.cfg.repChecks(this.minM));
    const score = Math.max(0, Math.round(100 - issues.reduce((a, i) => a + i.penalty, 0)));
    this.count++;
    return { n: this.count, score, issues: issues.map((i) => i.key), depth: Math.round(this.minM) };
  }
}
