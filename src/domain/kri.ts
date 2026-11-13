import { isActive } from './deviations'
import { LEVELS } from './escalation'
import { SYSTEM_ACTOR } from './people'
import { holdsUnits, isOverdue, storageCheck } from './rules'
import type { AppState, EscalationLevel } from './types'

// Key risk indicators for the Board (Reg 5(2): KPIs with periodic monitoring and evaluation).
// Everything is derived from tanks, deviations and the audit log, so the numbers can't be edited directly.

const SERVICE_SOON_DAYS = 14

export interface ChangeRequestStats {
  personId: string
  requested: number
  approved: number
  rejected: number
}

export interface Kris {
  /** All tanks holding units, including tanks outside active monitoring. */
  tanksHoldingUnits: number
  /** Tanks holding units whose storage status is unknown (unmonitored, unverified or no recent data). */
  tanksUnknown: number
  tanksInLimit: number
  tanksInLimitPct: number
  tanksInUse: number
  serviceDueSoon: number
  serviceDueSoonPct: number
  openDeviations: number
  openCritical: number
  /** Closed after a root cause, CAPA and approval */
  closedDeviations: number
  /** Closed by an approved dismissal, with no investigation */
  dismissedDeviations: number
  /** Share of deviations closed after investigation; dismissals don't count as resolved */
  resolvedPct: number
  /** Open deviations past their deadline, at any level */
  overdueNow: number
  /** Of those, deviations at MOH whose response deadline has passed (they can't escalate further) */
  overdueMohResponses: number
  missedDeadlines: number
  mohNotified: number
  openByLevel: Record<EscalationLevel, number>
  ageing: { label: string; count: number }[]
  changeRequests: ChangeRequestStats[]
}

const pct = (part: number, whole: number) => (whole === 0 ? 100 : Math.round((part / whole) * 100))

export function computeKris(s: AppState): Kris {
  const now = new Date(s.simTime).getTime()

  const holdingUnits = s.tanks.filter(holdsUnits)
  const checks = holdingUnits.map((t) => storageCheck(t, s.settings, s.simTime))
  const inLimit = checks.filter((c) => c === 'in_limit').length
  const unknown = checks.filter((c) => c === 'unknown').length
  const inUse = s.tanks.filter((t) => t.serviceStatus !== 'not_in_use')
  const dueSoon = inUse.filter(
    (t) =>
      t.serviceStatus === 'due_service' ||
      new Date(t.nextServiceDue).getTime() - now <= SERVICE_SOON_DAYS * 86_400_000,
  ).length

  const active = s.deviations.filter(isActive)
  const dismissed = s.deviations.filter((d) => !isActive(d) && d.dismissed).length
  const closed = s.deviations.length - active.length - dismissed

  const openByLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<EscalationLevel, number>
  active.forEach((d) => openByLevel[d.escalationLevel]++)

  const ageDays = active.map((d) => (now - new Date(d.raisedAt).getTime()) / 86_400_000)
  const ageing = [
    { label: 'Under 1 day', count: ageDays.filter((a) => a < 1).length },
    { label: '1 to 7 days', count: ageDays.filter((a) => a >= 1 && a <= 7).length },
    { label: 'Over 7 days', count: ageDays.filter((a) => a > 7).length },
  ]

  // Downgrade and dismissal requests by person: the indicator that would have shown
  // one officer repeatedly deciding deviations were "not a concern"
  const byPerson = new Map<string, ChangeRequestStats>()
  const requestsByDeviation = new Map<string, string>()
  for (const a of s.audit) {
    if (a.action === 'deviation.change_requested') {
      const stats = byPerson.get(a.actorId) ?? { personId: a.actorId, requested: 0, approved: 0, rejected: 0 }
      stats.requested++
      byPerson.set(a.actorId, stats)
      requestsByDeviation.set(a.entityId, a.actorId)
    } else if (['deviation.downgraded', 'deviation.dismissed', 'deviation.change_rejected'].includes(a.action)) {
      const requester = requestsByDeviation.get(a.entityId)
      const stats = requester ? byPerson.get(requester) : undefined
      if (stats) {
        if (a.action === 'deviation.change_rejected') stats.rejected++
        else stats.approved++
      }
      requestsByDeviation.delete(a.entityId)
    }
  }

  return {
    tanksHoldingUnits: holdingUnits.length,
    tanksUnknown: unknown,
    tanksInLimit: inLimit,
    tanksInLimitPct: pct(inLimit, holdingUnits.length),
    tanksInUse: inUse.length,
    serviceDueSoon: dueSoon,
    serviceDueSoonPct: pct(dueSoon, inUse.length),
    openDeviations: active.length,
    openCritical: active.filter((d) => d.severity === 'critical').length,
    closedDeviations: closed,
    dismissedDeviations: dismissed,
    resolvedPct: pct(closed, s.deviations.length),
    overdueNow: active.filter((d) => isOverdue(d.dueAt, s.simTime)).length,
    overdueMohResponses: active.filter((d) => d.escalationLevel === 'moh' && isOverdue(d.dueAt, s.simTime)).length,
    missedDeadlines: s.audit.filter((a) => a.action === 'deviation.escalated' && a.actorId === SYSTEM_ACTOR).length,
    mohNotified: s.deviations.filter((d) => d.mohNotifiedAt).length,
    openByLevel,
    ageing,
    changeRequests: [...byPerson.values()].sort((a, b) => b.requested - a.requested),
  }
}
