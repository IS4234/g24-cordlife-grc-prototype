import { formatDateTime, formatSpan } from '../lib/format'
import { SERVICE_LABEL, SEVERITY, TRIGGER_LABEL } from '../lib/labels'
import { withAudit } from './audit'
import { activeSensorDeviation, activeSensorDeviations, createDeviation, type NewDeviation, updateDeviation } from './deviations'
import { notifyMohIfDue } from './escalation'
import { SYSTEM_ACTOR } from './people'
import { atLeast, BREACH_LIMIT_C, dueAtFor, isInService, isMonitored, isOverdue, LN2_LOW_PCT, severityForBreach } from './rules'
import type { AppState, SensorTrigger, Tank } from './types'

type Finding = Omit<NewDeviation, 'source' | 'raisedBy' | 'tankId' | 'trigger'>
type Check = (t: Tank, s: AppState) => Finding | undefined

/** Minutes a tank must stay above the warning level before it counts, so a tank hovering at the line does not flicker */
export const WARNING_DWELL_MIN = 3

const units = (t: Tank) => `${t.cbuCount.toLocaleString()} cord blood units`

/**
 * Stages of one storage incident, least to most severe. A tank losing LN2 goes low, then warms
 * past the warning level, then breaches. Each stage upgrades the same deviation rather than
 * opening a new one, so the incident reads as one record with its full timeline.
 */
const STORAGE_STAGES: { trigger: SensorTrigger; check: Check }[] = [
  {
    trigger: 'ln2_low',
    check: (t, s) =>
      isInService(t) && t.ln2LevelPct < LN2_LOW_PCT
        ? {
            title: `${t.id} LN2 level low`,
            description: `${t.id} LN2 level fell to ${Math.round(t.ln2LevelPct)}%, below the ${LN2_LOW_PCT}% refill level. If it is not refilled the tank will start to warm${t.cbuCount > 0 ? `, putting ${units(t)} at risk` : ''}.`,
            category: 'storage_temperature',
            severity: t.cbuCount > 0 ? 'major' : 'minor',
            evidence: [`LN2 level ${t.ln2LevelPct}% at ${formatDateTime(s.simTime)}`],
          }
        : undefined,
  },
  {
    trigger: 'temp_warning',
    check: (t, s) => {
      const recent = t.history.slice(-WARNING_DWELL_MIN)
      const sustained = recent.length === WARNING_DWELL_MIN && recent.every((c) => c > s.settings.warningC)
      return isMonitored(t) && sustained
        ? {
            title: `${t.id} temperature above ${s.settings.warningC} °C warning level`,
            description: `${t.id} has been warmer than the ${s.settings.warningC} °C warning level for ${WARNING_DWELL_MIN} minutes, at ${t.tempC} °C. ${units(t)} stored in this tank. It will breach at ${BREACH_LIMIT_C} °C if it keeps warming.`,
            category: 'storage_temperature',
            severity: 'major',
            evidence: [`Probe reading ${t.tempC} °C at ${formatDateTime(s.simTime)}`],
          }
        : undefined
    },
  },
  {
    trigger: 'breach',
    check: (t, s) =>
      isMonitored(t) && t.tempC > BREACH_LIMIT_C
        ? {
            title: `${t.id} temperature above ${BREACH_LIMIT_C} °C`,
            description: `Probe reading of ${t.tempC} °C exceeded the ${BREACH_LIMIT_C} °C limit. ${units(t)} stored in this tank.`,
            category: 'storage_temperature',
            severity: severityForBreach(t),
            evidence: [`Probe reading ${t.tempC} °C at ${formatDateTime(s.simTime)}`],
          }
        : undefined,
  },
]

const STAGE_TRIGGERS = STORAGE_STAGES.map((st) => st.trigger)

/** Other conditions that make a tank's storage or monitoring untrustworthy, each its own deviation */
const CHECKS: Partial<Record<SensorTrigger, Check>> = {
  unmonitored_units: (t, s) =>
    t.cbuCount > 0 && !isInService(t)
      ? {
          title: `${t.id} holding units while not monitored`,
          description: `${t.id} is marked "${SERVICE_LABEL[t.serviceStatus]}" but holds ${units(t)}. Its readings are not checked against the breach limit, so a temperature failure would go undetected.`,
          category: 'storage_temperature',
          severity: 'critical',
          evidence: [`Tank status at ${formatDateTime(s.simTime)}: ${SERVICE_LABEL[t.serviceStatus]}, ${t.cbuCount} units`],
        }
      : undefined,

  probe_unverified: (t, s) =>
    isInService(t) && !t.probeVerified
      ? {
          title: `${t.id} in service without verified probe mapping`,
          description: `${t.id} is in service but its probe-to-tank mapping has not been verified since maintenance. Its readings may come from a different tank, so its temperature status cannot be trusted.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'critical' : 'major',
          evidence: [`Probe mapping unverified at ${formatDateTime(s.simTime)}`],
        }
      : undefined,

  service_overdue: (t, s) =>
    isInService(t) && isOverdue(t.nextServiceDue, s.simTime)
      ? {
          title: `${t.id} scheduled service overdue`,
          description: `${t.id} was due for service on ${formatDateTime(t.nextServiceDue)} and is still in use${t.cbuCount > 0 ? ` with ${units(t)}` : ''}.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'major' : 'minor',
          evidence: [`Service due ${formatDateTime(t.nextServiceDue)}; checked at ${formatDateTime(s.simTime)}`],
        }
      : undefined,

  calibration_overdue: (t, s) =>
    isInService(t) && isOverdue(t.calibrationDue, s.simTime)
      ? {
          title: `${t.id} probe calibration overdue`,
          description: `${t.id} probe was due for calibration on ${formatDateTime(t.calibrationDue)}. Until it is calibrated its readings may drift without anyone noticing.`,
          category: 'equipment',
          severity: t.cbuCount > 0 ? 'major' : 'minor',
          evidence: [`Calibration due ${formatDateTime(t.calibrationDue)}; checked at ${formatDateTime(s.simTime)}`],
        }
      : undefined,
}

function raise(s: AppState, tank: Tank, trigger: SensorTrigger, finding: Finding): AppState {
  return createDeviation(s, { ...finding, source: 'sensor', raisedBy: SYSTEM_ACTOR, tankId: tank.id, trigger })
}

/**
 * Moves an open storage incident to a later stage. Severity only ever goes up here; lowering it
 * still needs the two-person approval. The deadline tightens if the new severity's is sooner.
 */
function upgrade(s: AppState, id: string, trigger: SensorTrigger, finding: Finding): AppState {
  const cur = s.deviations.find((d) => d.id === id)!
  const severity = atLeast(cur.severity, finding.severity) ? cur.severity : finding.severity
  const raised = severity !== cur.severity
  const newDue = dueAtFor(severity, s.simTime, s.settings)
  const dueAt = raised && newDue < cur.dueAt ? newDue : cur.dueAt

  let next = updateDeviation(s, id, (d) => ({
    ...d,
    trigger,
    severity,
    dueAt,
    title: finding.title,
    description: finding.description,
    evidence: [...d.evidence, ...finding.evidence],
  }))
  const change = raised ? `Severity raised from ${SEVERITY[cur.severity].label} to ${SEVERITY[severity].label}. ` : ''
  next = withAudit(next, {
    actorId: SYSTEM_ACTOR,
    action: 'deviation.upgraded',
    entityId: id,
    detail: `Incident worsened from ${TRIGGER_LABEL[cur.trigger ?? 'breach']} to ${TRIGGER_LABEL[trigger]}. ${change}${finding.evidence[0]}.`,
  })
  return notifyMohIfDue(next, id)
}

function checkStorage(s: AppState, tank: Tank): AppState {
  // The most severe stage the tank is in right now
  let stage: { trigger: SensorTrigger; finding: Finding } | undefined
  for (const st of STORAGE_STAGES) {
    const finding = st.check(tank, s)
    if (finding) stage = { trigger: st.trigger, finding }
  }
  if (!stage) return s

  const open = activeSensorDeviations(s, tank.id).find((d) => STAGE_TRIGGERS.includes(d.trigger ?? 'breach'))
  if (!open) return raise(s, tank, stage.trigger, stage.finding)

  const reached = STAGE_TRIGGERS.indexOf(open.trigger ?? 'breach')
  return STAGE_TRIGGERS.indexOf(stage.trigger) > reached ? upgrade(s, open.id, stage.trigger, stage.finding) : s
}

/** Records when an open storage incident's tank goes above the breach limit, its peak, and when it comes back */
function trackExcursion(s: AppState, tank: Tank): AppState {
  const open = activeSensorDeviations(s, tank.id).find((d) => STAGE_TRIGGERS.includes(d.trigger ?? 'breach'))
  if (!open) return s
  const above = isMonitored(tank) && tank.tempC > BREACH_LIMIT_C
  const list = open.excursions ?? []
  const last = list[list.length - 1]
  const running = last !== undefined && !last.endedAt

  if (above && !running) {
    const next = updateDeviation(s, open.id, (d) => ({
      ...d,
      excursions: [...list, { startedAt: s.simTime, peakC: tank.tempC }],
    }))
    // The first excursion is already logged when the incident reaches the breach stage
    if (list.length === 0) return next
    return withAudit(next, {
      actorId: SYSTEM_ACTOR,
      action: 'deviation.excursion_started',
      entityId: open.id,
      detail: `${tank.id} back above ${BREACH_LIMIT_C} °C at ${tank.tempC} °C.`,
    })
  }
  if (above && running) {
    if (tank.tempC <= last.peakC) return s
    return updateDeviation(s, open.id, (d) => ({
      ...d,
      excursions: list.map((e, i) => (i === list.length - 1 ? { ...e, peakC: tank.tempC } : e)),
    }))
  }
  if (!above && running) {
    const minutes = Math.round((new Date(s.simTime).getTime() - new Date(last.startedAt).getTime()) / 60_000)
    const next = updateDeviation(s, open.id, (d) => ({
      ...d,
      excursions: list.map((e, i) => (i === list.length - 1 ? { ...e, endedAt: s.simTime } : e)),
    }))
    return withAudit(next, {
      actorId: SYSTEM_ACTOR,
      action: 'deviation.excursion_ended',
      entityId: open.id,
      detail: `${tank.id} back below ${BREACH_LIMIT_C} °C after ${formatSpan(minutes)} above the limit. Peak ${last.peakC.toFixed(1)} °C.`,
    })
  }
  return s
}

/** Raises at most one open deviation per tank per condition, and one per storage incident */
export function detectTankIssues(s: AppState): AppState {
  let next = s
  for (const tank of s.tanks) {
    next = trackExcursion(checkStorage(next, tank), tank)
    for (const [trigger, check] of Object.entries(CHECKS) as [SensorTrigger, Check][]) {
      const finding = check(tank, next)
      if (!finding || activeSensorDeviation(next, tank.id, trigger)) continue
      next = raise(next, tank, trigger, finding)
    }
  }
  return next
}
