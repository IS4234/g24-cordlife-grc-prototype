import { LEVEL_LABEL } from '../lib/labels'
import { withAudit } from './audit'
import { SYSTEM_ACTOR } from './people'
import { atLeast, dueAtFor } from './rules'
import type { AppState, Deviation, SensorTrigger } from './types'

export type NewDeviation = Pick<
  Deviation,
  'title' | 'description' | 'source' | 'category' | 'severity' | 'raisedBy' | 'evidence'
> & { tankId?: string; unitsAffected?: number; trigger?: SensorTrigger }

export function createDeviation(s: AppState, input: NewDeviation): AppState {
  const year = new Date(s.simTime).getFullYear()
  const id = `DEV-${year}-${String(s.nextDeviationSeq).padStart(3, '0')}`
  const deviation: Deviation = {
    ...input,
    id,
    status: 'open',
    escalationLevel: 'operator',
    raisedAt: s.simTime,
    dueAt: dueAtFor(input.severity, s.simTime, s.settings),
    approvals: [],
  }
  const how = input.source === 'sensor' ? 'Automatically raised' : 'Raised'
  const next = withAudit(
    { ...s, deviations: [...s.deviations, deviation], nextDeviationSeq: s.nextDeviationSeq + 1 },
    {
      actorId: input.raisedBy,
      action: 'deviation.created',
      entityId: id,
      detail: `${how} ${input.severity} deviation: ${input.title}`,
    },
  )
  return notifyMohIfDue(next, id, `${input.severity} deviation created`)
}

export function updateDeviation(s: AppState, id: string, update: (d: Deviation) => Deviation): AppState {
  return { ...s, deviations: s.deviations.map((d) => (d.id === id ? update(d) : d)) }
}

export function isActive(d: Deviation): boolean {
  return d.status !== 'closed'
}

/** Critical deviations notify MOH immediately; other severities follow the Board's reporting rule. */
export function notifyMohIfDue(s: AppState, id: string, why?: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || d.mohNotifiedAt || !isActive(d)) return s
  const reportable =
    d.severity === 'critical' ||
    d.escalationLevel === 'moh' ||
    (d.escalationLevel === 'board' && atLeast(d.severity, s.settings.mohNotifySeverity))
  if (!reportable) return s
  const next = updateDeviation(s, id, (cur) => ({ ...cur, mohNotifiedAt: s.simTime }))
  return withAudit(next, {
    actorId: SYSTEM_ACTOR,
    action: 'deviation.moh_notified',
    entityId: id,
    detail: `Pushed to MOH: ${why ?? `deviation became ${d.severity}`} while at ${LEVEL_LABEL[d.escalationLevel]}.`,
  })
}

/** Open system-raised deviations for a tank, optionally for one condition */
export function activeSensorDeviations(s: AppState, tankId: string, trigger?: SensorTrigger): Deviation[] {
  return s.deviations.filter(
    (d) =>
      d.source === 'sensor' &&
      d.tankId === tankId &&
      isActive(d) &&
      (trigger === undefined || (d.trigger ?? 'breach') === trigger),
  )
}

export function activeSensorDeviation(s: AppState, tankId: string, trigger: SensorTrigger): Deviation | undefined {
  return activeSensorDeviations(s, tankId, trigger)[0]
}

/** Active ones by nearest deadline first; closed ones newest first */
export function sortForRegister(list: Deviation[]): Deviation[] {
  return [...list].sort((a, b) => {
    const aActive = isActive(a)
    const bActive = isActive(b)
    if (aActive !== bActive) return aActive ? -1 : 1
    if (aActive) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    return new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime()
  })
}
