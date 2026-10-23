import { withAudit } from '../domain/audit'
import {
  approveChange,
  approveClosure,
  type ClosureSubmission,
  rejectChange,
  rejectClosure,
  requestChange,
  submitForClosure,
} from '../domain/closure'
import { createDeviation, type NewDeviation } from '../domain/deviations'
import { assignOwner, escalateManually } from '../domain/escalation'
import { advanceMinutes } from '../domain/simulation'
import { updateSettings } from '../domain/settings'
import type { EscalationLevel, RiskSettings, Severity } from '../domain/types'
import { setState } from './store'

export function submitClosure(id: string, actorId: string, input: ClosureSubmission) {
  setState((s) => submitForClosure(s, id, actorId, input))
}

export function approveDeviationClosure(id: string, personId: string, note?: string) {
  setState((s) => approveClosure(s, id, personId, note))
}

export function rejectDeviationClosure(id: string, personId: string, reason: string) {
  setState((s) => rejectClosure(s, id, personId, reason))
}

export function requestDeviationChange(
  id: string,
  actorId: string,
  kind: 'downgrade' | 'dismiss',
  reason: string,
  to?: Severity,
) {
  setState((s) => requestChange(s, id, actorId, kind, reason, to))
}

export function decideDeviationChange(id: string, personId: string, approve: boolean) {
  setState((s) => (approve ? approveChange(s, id, personId) : rejectChange(s, id, personId)))
}

export function saveRiskSettings(next: RiskSettings, actorId: string, reason: string) {
  setState((s) => updateSettings(s, next, actorId, reason))
}

export function raiseDeviation(input: NewDeviation) {
  setState((s) => createDeviation(s, input))
}

export function escalateDeviation(id: string, to: EscalationLevel, actorId: string, reason: string) {
  setState((s) => escalateManually(s, id, to, actorId, reason))
}

export function assignDeviation(id: string, ownerId: string, actorId: string) {
  setState((s) => assignOwner(s, id, ownerId, actorId))
}

export function advanceClock(minutes: number) {
  setState((s) => advanceMinutes(s, minutes))
}

/** Demo control: makes a tank start warming, as if LN2 supply failed. Not audited, since it is not a real event. */
export function injectWarmingFault(tankId: string) {
  setState((s) => ({
    ...s,
    tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, fault: 'warming' } : t)),
  }))
}

export function restoreCooling(tankId: string, personId: string) {
  setState((s) =>
    withAudit(
      { ...s, tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, fault: undefined } : t)) },
      {
        actorId: personId,
        action: 'tank.cooling_restored',
        entityId: tankId,
        detail: `${tankId} LN2 supply restored; temperature recovering. Any linked deviation stays open for investigation.`,
      },
    ),
  )
}
