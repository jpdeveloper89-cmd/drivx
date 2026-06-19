interface ScoreRingProps {
  score: number;
  size?: number;
}

export function ScoreRing({ score, size = 56 }: ScoreRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 1000) * circumference;

  const color =
    score >= 800 ? '#22d3ee' :
    score >= 600 ? '#a78bfa' :
    '#f87171';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
