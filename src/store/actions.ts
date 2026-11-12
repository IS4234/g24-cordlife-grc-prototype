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
import { acknowledgeAlert, assignOwner, escalateManually } from '../domain/escalation'
import { addMinutes, CALIBRATION_INTERVAL_DAYS, isInService, loadBlockReason } from '../domain/rules'
import { advanceMinutes } from '../domain/simulation'
import { detectTankIssues } from '../domain/tankChecks'
import { updateSettings } from '../domain/settings'
import type { AppState, EscalationLevel, RiskSettings, Severity, Tank } from '../domain/types'
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

export function acknowledgeMohAlert(id: string, actorId: string) {
  setState((s) => acknowledgeAlert(s, id, actorId))
}

export function assignDeviation(id: string, ownerId: string, actorId: string) {
  setState((s) => assignOwner(s, id, ownerId, actorId))
}

export function advanceClock(minutes: number) {
  setState((s) => advanceMinutes(s, minutes))
}

/** Demo control: cuts a tank's LN2 supply, so it drains and then warms. Not audited, since it is not a real event. */
export function injectWarmingFault(tankId: string) {
  setState((s) => ({
    ...s,
    tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, fault: 'ln2_failure' } : t)),
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
        detail: `${tankId} LN2 supply restored; tank refilling and temperature recovering. Any linked deviation stays open for investigation.`,
      },
    ),
  )
}

const SERVICE_INTERVAL_DAYS = 90

function updateTank(s: AppState, tankId: string, update: (t: Tank) => Tank): AppState {
  return { ...s, tanks: s.tanks.map((t) => (t.id === tankId ? update(t) : t)) }
}

/** Confirms the probe is wired to the right tank after maintenance */
export function verifyProbeMapping(tankId: string, personId: string) {
  setState((s) =>
    withAudit(
      updateTank(s, tankId, (t) => ({ ...t, probeVerified: true })),
      {
        actorId: personId,
        action: 'tank.probe_verified',
        entityId: tankId,
        detail: `${tankId} probe-to-tank mapping verified against a reference reading.`,
      },
    ),
  )
}

/** Ends maintenance. Allowed before probe verification, but the checks will then raise a deviation. */
export function returnTankToService(tankId: string, personId: string) {
  setState((s) => {
    const tank = s.tanks.find((t) => t.id === tankId)
    if (!tank || tank.serviceStatus !== 'servicing') return s
    const next = withAudit(
      updateTank(s, tankId, (t) => ({
        ...t,
        serviceStatus: 'in_service',
        lastServicedAt: s.simTime,
        nextServiceDue: addMinutes(s.simTime, SERVICE_INTERVAL_DAYS * 1440),
      })),
      {
        actorId: personId,
        action: 'tank.returned_to_service',
        entityId: tankId,
        detail: tank.probeVerified
          ? `${tankId} returned to service after maintenance.`
          : `${tankId} returned to service without probe mapping verification.`,
      },
    )
    return detectTankIssues(next)
  })
}

/** Records scheduled maintenance completed outside the monitoring workflow. */
export function recordService(tankId: string, personId: string) {
  setState((s) => {
    const tank = s.tanks.find((t) => t.id === tankId)
    if (!tank || !isInService(tank)) return s
    return withAudit(
      updateTank(s, tankId, (t) => ({
        ...t,
        serviceStatus: 'in_service',
        lastServicedAt: s.simTime,
        nextServiceDue: addMinutes(s.simTime, SERVICE_INTERVAL_DAYS * 1440),
      })),
      {
        actorId: personId,
        action: 'tank.service_completed',
        entityId: tankId,
        detail: `${tankId} service completion recorded. Next service due in ${SERVICE_INTERVAL_DAYS} days. Any linked deviation stays open for investigation.`,
      },
    )
  })
}

/** Demo control: units placed in a tank that is not being monitored. Not audited, since it is not a real event. */
export function injectUnmonitoredUnits(tankId: string) {
  setState((s) => detectTankIssues(updateTank(s, tankId, (t) => ({ ...t, cbuCount: 420 }))))
}

/** Records a probe calibration against a reference thermometer */
export function recordCalibration(tankId: string, personId: string) {
  setState((s) =>
    withAudit(
      updateTank(s, tankId, (t) => ({
        ...t,
        lastCalibratedAt: s.simTime,
        calibrationDue: addMinutes(s.simTime, CALIBRATION_INTERVAL_DAYS * 1440),
      })),
      {
        actorId: personId,
        action: 'tank.probe_calibrated',
        entityId: tankId,
        detail: `${tankId} probe calibrated against a reference thermometer. Next calibration due in ${CALIBRATION_INTERVAL_DAYS} days.`,
      },
    ),
  )
}

/** Stores units in a tank. Refused while the tank is not in service or its probe is unverified. */
export function loadUnits(tankId: string, count: number, personId: string) {
  setState((s) => {
    const tank = s.tanks.find((t) => t.id === tankId)
    if (!tank || loadBlockReason(tank, s.settings, s.simTime) || !Number.isInteger(count) || count <= 0) return s
    if (tank.cbuCount + count > tank.capacity) return s
    const next = withAudit(
      updateTank(s, tankId, (t) => ({ ...t, cbuCount: t.cbuCount + count })),
      {
        actorId: personId,
        action: 'tank.units_loaded',
        entityId: tankId,
        detail: `${count.toLocaleString()} cord blood units loaded into ${tankId} (now ${(tank.cbuCount + count).toLocaleString()} of ${tank.capacity.toLocaleString()}).`,
      },
    )
    return detectTankIssues(next)
  })
}

/** Demo control: the tank's probe stops reporting. Not audited, since it is not a real event. */
export function injectProbeDropout(tankId: string) {
  setState((s) => updateTank(s, tankId, (t) => ({ ...t, probeOffline: true })))
}

export function restoreProbeFeed(tankId: string, personId: string) {
  setState((s) =>
    withAudit(
      updateTank(s, tankId, (t) => ({ ...t, probeOffline: false })),
      {
        actorId: personId,
        action: 'tank.probe_restored',
        entityId: tankId,
        detail: `${tankId} probe feed restored; readings resume from the next minute. Any linked deviation stays open for investigation.`,
      },
    ),
  )
}
