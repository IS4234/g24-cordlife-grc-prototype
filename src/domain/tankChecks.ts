import { formatDateTime } from '../lib/format'
import { SERVICE_LABEL } from '../lib/labels'
import { activeSensorDeviation, createDeviation, type NewDeviation } from './deviations'
import { SYSTEM_ACTOR } from './people'
import { BREACH_LIMIT_C, isInService, isOverdue, LN2_LOW_PCT, severityForBreach, tempStatus } from './rules'
import type { AppState, SensorTrigger, Tank } from './types'

type Finding = Omit<NewDeviation, 'source' | 'raisedBy' | 'tankId' | 'trigger'>

const units = (t: Tank) => `${t.cbuCount.toLocaleString()} cord blood units`

/**
 * Conditions that make a tank's storage or monitoring untrustworthy. Each returns a deviation
 * to raise, or nothing. Nobody decides whether these exist; the system raises them.
 */
const CHECKS: Record<SensorTrigger, (t: Tank, s: AppState) => Finding | undefined> = {
  breach: (t, s) =>
    tempStatus(t, s.settings) === 'breach'
      ? {
          title: `${t.id} temperature above ${BREACH_LIMIT_C} °C`,
          description: `Probe reading of ${t.tempC} °C exceeded the ${BREACH_LIMIT_C} °C limit. ${units(t)} stored in this tank.`,
          category: 'storage_temperature',
          severity: severityForBreach(t),
          evidence: [`Probe reading ${t.tempC} °C at ${s.simTime}`],
        }
      : undefined,

  unmonitored_units: (t, s) =>
    t.cbuCount > 0 && !isInService(t)
      ? {
          title: `${t.id} holding units while not monitored`,
          description: `${t.id} is marked "${SERVICE_LABEL[t.serviceStatus]}" but holds ${units(t)}. Its readings are not checked against the breach limit, so a temperature failure would go undetected.`,
          category: 'storage_temperature',
          severity: 'critical',
          evidence: [`Tank status at ${s.simTime}: ${SERVICE_LABEL[t.serviceStatus]}, ${t.cbuCount} units`],
        }
      : undefined,

  probe_unverified: (t, s) =>
    isInService(t) && !t.probeVerified
      ? {
          title: `${t.id} in service without verified probe mapping`,
          description: `${t.id} is in service but its probe-to-tank mapping has not been verified since maintenance. Its readings may come from a different tank, so its temperature status cannot be trusted.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'critical' : 'major',
          evidence: [`Probe mapping unverified at ${s.simTime}`],
        }
      : undefined,

  service_overdue: (t, s) =>
    isInService(t) && isOverdue(t.nextServiceDue, s.simTime)
      ? {
          title: `${t.id} scheduled service overdue`,
          description: `${t.id} was due for service on ${formatDateTime(t.nextServiceDue)} and is still in use${t.cbuCount > 0 ? ` with ${units(t)}` : ''}.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'major' : 'minor',
          evidence: [`Service due ${t.nextServiceDue}; checked at ${s.simTime}`],
        }
      : undefined,

  ln2_low: (t, s) =>
    isInService(t) && t.ln2LevelPct < LN2_LOW_PCT
      ? {
          title: `${t.id} LN2 level low`,
          description: `${t.id} LN2 level fell to ${Math.round(t.ln2LevelPct)}%, below the ${LN2_LOW_PCT}% refill level. If it is not refilled the tank will start to warm${t.cbuCount > 0 ? `, putting ${units(t)} at risk` : ''}.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'major' : 'minor',
          evidence: [`LN2 level ${t.ln2LevelPct}% at ${s.simTime}`],
        }
      : undefined,

  calibration_overdue: (t, s) =>
    isInService(t) && isOverdue(t.calibrationDue, s.simTime)
      ? {
          title: `${t.id} probe calibration overdue`,
          description: `${t.id} probe was due for calibration on ${formatDateTime(t.calibrationDue)}. Until it is calibrated its readings may drift without anyone noticing.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'major' : 'minor',
          evidence: [`Calibration due ${t.calibrationDue}; checked at ${s.simTime}`],
        }
      : undefined,
}

const TRIGGERS = Object.keys(CHECKS) as SensorTrigger[]

/** Raises at most one open deviation per tank per condition */
export function detectTankIssues(s: AppState): AppState {
  let next = s
  for (const tank of s.tanks) {
    for (const trigger of TRIGGERS) {
      const finding = CHECKS[trigger](tank, next)
      if (!finding || activeSensorDeviation(next, tank.id, trigger)) continue
      next = createDeviation(next, { ...finding, source: 'sensor', raisedBy: SYSTEM_ACTOR, tankId: tank.id, trigger })
    }
  }
  return next
}
