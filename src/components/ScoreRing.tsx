export const scoreColor = (v: number) => (v >= 85 ? '#1f7a4d' : v >= 60 ? '#b97d00' : '#d4380d');

export default function ScoreRing({
  value, label, empty, size = 124,
}: { value: number; label: string; empty?: boolean; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = empty ? '#d6d1c4' : scoreColor(value);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4dfd2" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="butt"
          strokeDasharray={c} strokeDashoffset={c * (1 - (empty ? 0 : value) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <div className="ring-text">
        <b style={{ color: empty ? '#9a958a' : color }}>{empty ? '–' : value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
