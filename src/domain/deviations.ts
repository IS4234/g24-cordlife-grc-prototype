import { withAudit } from './audit'
import { dueAtFor } from './rules'
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
  return withAudit(
    { ...s, deviations: [...s.deviations, deviation], nextDeviationSeq: s.nextDeviationSeq + 1 },
    {
      actorId: input.raisedBy,
      action: 'deviation.created',
      entityId: id,
      detail: `${how} ${input.severity} deviation: ${input.title}`,
    },
  )
}

export function updateDeviation(s: AppState, id: string, update: (d: Deviation) => Deviation): AppState {
  return { ...s, deviations: s.deviations.map((d) => (d.id === id ? update(d) : d)) }
}

export function isActive(d: Deviation): boolean {
  return d.status !== 'closed'
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
