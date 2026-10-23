import { isActive } from './deviations'
import { computeKris } from './kri'
import { isOverdue } from './rules'
import type { AppState } from './types'

// Compliance posture for the regulator: a 0-100 score from four weighted components.
// The formula is shown on screen so MOH and the licensee read the score the same way.

export type Rating = 'good' | 'attention' | 'at_risk'

export interface PostureComponent {
  id: string
  label: string
  weight: number
  score: number
  basis: string
}

export interface Posture {
  score: number
  rating: Rating
  components: PostureComponent[]
  /** Set when a rule caps the score regardless of the weighted total */
  cap?: string
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function computePosture(s: AppState): Posture {
  const k = computeKris(s)
  const active = s.deviations.filter(isActive)
  const onTime = active.filter((d) => d.escalationLevel === 'moh' || !isOverdue(d.dueAt, s.simTime)).length
  const highLevel = active.filter((d) => d.escalationLevel === 'board' || d.escalationLevel === 'moh').length
  const approvedChanges = k.changeRequests.reduce((n, r) => n + r.approved, 0)

  const components: PostureComponent[] = [
    {
      id: 'storage',
      label: 'Storage conditions',
      weight: 0.3,
      score: k.tanksInLimitPct,
      basis: `${k.tanksInLimit} of ${k.monitoredTanks} monitored tanks within limit`,
    },
    {
      id: 'timeliness',
      label: 'Deviation timeliness',
      weight: 0.3,
      score: clamp(active.length ? (onTime / active.length) * 100 : 100),
      basis: `${onTime} of ${active.length} open deviations within deadline`,
    },
    {
      id: 'escalation',
      label: 'Escalation load',
      weight: 0.2,
      score: clamp(100 - highLevel * 25),
      basis: `${highLevel} open at Board or MOH level (−25 each)`,
    },
    {
      id: 'integrity',
      label: 'Reporting integrity',
      weight: 0.2,
      score: clamp(100 - approvedChanges * 20),
      basis: `${approvedChanges} approved downgrade${approvedChanges === 1 ? '' : 's'} or dismissals (−20 each)`,
    },
  ]

  let score = clamp(components.reduce((sum, c) => sum + c.score * c.weight, 0))
  let cap: string | undefined
  // An unresolved critical deviation already reported to MOH always means "at risk"
  const openCriticalAlerts = active.filter((d) => d.mohNotifiedAt && d.severity === 'critical').length
  if (openCriticalAlerts > 0 && score > 69) {
    score = 69
    cap = `Capped at 69 while ${openCriticalAlerts} critical alert${openCriticalAlerts === 1 ? ' is' : 's are'} unresolved`
  }

  const rating: Rating = score >= 85 ? 'good' : score >= 70 ? 'attention' : 'at_risk'
  return { score, rating, components, cap }
}
