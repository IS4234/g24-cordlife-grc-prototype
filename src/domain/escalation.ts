import { LEVEL_LABEL } from '../lib/labels'
import { withAudit } from './audit'
import { isActive, updateDeviation } from './deviations'
import { getPerson, personName, SYSTEM_ACTOR } from './people'
import { atLeast, dueAtFor, isOverdue } from './rules'
import type { AppState, Deviation, EscalationLevel } from './types'

export const LEVELS: EscalationLevel[] = ['operator', 'cgo', 'board', 'moh']

export function levelsAbove(level: EscalationLevel): EscalationLevel[] {
  return LEVELS.slice(LEVELS.indexOf(level) + 1)
}

function escalate(s: AppState, d: Deviation, to: EscalationLevel, actorId: string, reason: string): AppState {
  // Severe deviations reach MOH as soon as the Board sees them, without waiting for the Board to act
  const notifyMoh =
    !d.mohNotifiedAt && (to === 'moh' || (to === 'board' && atLeast(d.severity, s.settings.mohNotifySeverity)))

  let next = updateDeviation(s, d.id, (cur) => ({
    ...cur,
    escalationLevel: to,
    status: cur.status === 'pending_closure' ? cur.status : 'escalated',
    dueAt: dueAtFor(cur.severity, s.simTime, s.settings),
    mohNotifiedAt: notifyMoh ? s.simTime : cur.mohNotifiedAt,
  }))
  next = withAudit(next, {
    actorId,
    action: 'deviation.escalated',
    entityId: d.id,
    detail: `${reason}. Escalated from ${LEVEL_LABEL[d.escalationLevel]} to ${LEVEL_LABEL[to]}.`,
  })
  if (notifyMoh) {
    next = withAudit(next, {
      actorId: SYSTEM_ACTOR,
      action: 'deviation.moh_notified',
      entityId: d.id,
      detail: `Pushed to MOH: ${d.severity} deviation reached ${LEVEL_LABEL[to]}.`,
    })
  }
  return next
}

/** Runs every simulated minute. A missed deadline moves the deviation up one level. */
export function applyDeadlines(s: AppState): AppState {
  let next = s
  for (const d of s.deviations) {
    if (!isActive(d) || d.escalationLevel === 'moh') continue
    if (!isOverdue(d.dueAt, s.simTime)) continue
    const to = levelsAbove(d.escalationLevel)[0]
    next = escalate(next, d, to, SYSTEM_ACTOR, 'Deadline missed')
  }
  return next
}

/** Speak-up escalation: anyone can escalate to any higher level, but must give a reason. */
export function escalateManually(
  s: AppState,
  id: string,
  to: EscalationLevel,
  actorId: string,
  reason: string,
): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || !isActive(d) || !levelsAbove(d.escalationLevel).includes(to)) return s
  return escalate(s, d, to, actorId, `${personName(actorId)} escalated: ${reason.trim()}`)
}

export function assignOwner(s: AppState, id: string, ownerId: string, actorId: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || !isActive(d)) return s
  const next = updateDeviation(s, id, (cur) => ({
    ...cur,
    ownerId,
    status: cur.status === 'open' ? 'investigating' : cur.status,
  }))
  return withAudit(next, {
    actorId,
    action: 'deviation.assigned',
    entityId: id,
    detail: `Assigned to ${personName(ownerId)} (${getPerson(ownerId)?.title ?? ''}) for investigation`,
  })
}
