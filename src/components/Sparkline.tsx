import { HISTORY_LENGTH } from '../domain/simulation'

interface SparklineProps {
  values: number[]
  thresholdC: number
  tone: 'ok' | 'warn' | 'crit' | 'neutral'
}

const W = 200
const H = 44

export function Sparkline({ values, thresholdC, tone }: SparklineProps) {
  if (values.length < 2) return <div className="spark spark--empty" />

  // Keep the threshold in view so the gap to the limit is visible
  const min = Math.min(-195, ...values)
  const max = Math.max(thresholdC + 5, ...values)
  const x = (i: number) => ((i + HISTORY_LENGTH - values.length) / (HISTORY_LENGTH - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]

  return (
    <svg className={`spark spark--${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line className="spark__limit" x1="0" x2={W} y1={y(thresholdC)} y2={y(thresholdC)} />
      <polyline className="spark__line" points={points} fill="none" />
      <circle className="spark__end" cx={x(values.length - 1)} cy={y(last)} r="2.5" />
    </svg>
  )
}
