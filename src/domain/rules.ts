import type { DeviationCategory, RiskSettings, Severity, Tank } from './types'

/**
 * Cord blood must stay at or below -150 °C. This is the storage standard, not risk appetite,
 * so it is fixed here rather than in the Board's settings.
 */
export const BREACH_LIMIT_C = -150

/** Below this LN2 level the tank must be refilled; the system raises a deviation */
export const LN2_LOW_PCT = 25
/** Below this LN2 level there is not enough nitrogen to hold vapour-phase temperature */
export const LN2_EMPTY_PCT = 10
export const CALIBRATION_INTERVAL_DAYS = 365
/** A probe silent for this long is treated as offline; its last reading can no longer be trusted */
export const PROBE_STALE_MIN = 10

/** Whole minutes since the tank's probe last reported */
export function readingAgeMin(tank: Tank, now: string): number {
  return Math.max(0, Math.round((new Date(now).getTime() - new Date(tank.lastReadingAt).getTime()) / 60_000))
}

export type TempStatus = 'ok' | 'warning' | 'breach' | 'empty' | 'offline'

export function isInService(tank: Tank): boolean {
  return tank.serviceStatus === 'in_service' || tank.serviceStatus === 'due_service'
}

/** Every tank holding units belongs in storage reporting, regardless of service status. */
export function holdsUnits(tank: Tank): boolean {
  return tank.cbuCount > 0
}

/** A tank is monitored for breaches when it holds units and is in service */
export function isMonitored(tank: Tank): boolean {
  return holdsUnits(tank) && isInService(tank)
}

/**
 * Why units cannot be loaded into this tank right now, or nothing if they can. Units only go
 * into a tank that is in service, holding temperature, and whose readings can be trusted.
 */
export function loadBlockReason(tank: Tank, settings: RiskSettings, now: string): string | undefined {
  if (!isInService(tank)) return 'Units can only be loaded into a tank that is in service.'
  if (!tank.probeVerified) return 'Verify the probe mapping first. Units must not go into a tank whose readings cannot be trusted.'
  if (readingAgeMin(tank, now) >= PROBE_STALE_MIN) {
    return `The probe has not reported for ${readingAgeMin(tank, now)} minutes, so the tank's current temperature is unknown.`
  }
  if (tank.tempC > BREACH_LIMIT_C) return `The tank is above the ${BREACH_LIMIT_C} °C breach limit.`
  if (tank.tempC > settings.warningC) return `The tank is warmer than the ${settings.warningC} °C warning level.`
  if (tank.ln2LevelPct < LN2_LOW_PCT) return `LN2 is below the ${LN2_LOW_PCT}% refill level. Refill the tank first.`
  if (tank.cbuCount >= tank.capacity) return 'This tank is full.'
  return undefined
}

/** A reading counts only if the probe is mapped to the right tank and has reported recently */
export function readingTrusted(tank: Tank, now: string): boolean {
  return tank.probeVerified && readingAgeMin(tank, now) < PROBE_STALE_MIN
}

/**
 * Storage state for compliance reporting. Unmonitored tanks and tanks whose readings can't
 * be trusted are "unknown": an old safe reading is not proof of safe storage now.
 */
export function storageCheck(tank: Tank, settings: RiskSettings, now: string): 'in_limit' | 'breach' | 'unknown' {
  if (!isMonitored(tank) || !readingTrusted(tank, now)) return 'unknown'
  return tempStatus(tank, settings) === 'breach' ? 'breach' : 'in_limit'
}

export function tempStatus(tank: Tank, settings: RiskSettings): TempStatus {
  // An empty tank in service is ready for units, not a monitoring gap
  if (isInService(tank) && tank.cbuCount === 0) return 'empty'
  if (!isMonitored(tank)) return 'offline'
  if (tank.tempC > BREACH_LIMIT_C) return 'breach'
  if (tank.tempC > settings.warningC) return 'warning'
  return 'ok'
}

/**
 * Severity is set by rule, not by judgement. Any breach of a tank holding units is critical
 * because damage to cord blood is irreversible.
 */
export function severityForBreach(tank: Tank): Severity {
  return tank.cbuCount > 0 ? 'critical' : 'major'
}

const SEVERITY_RANK: Record<Severity, number> = { minor: 0, major: 1, critical: 2 }

export function atLeast(a: Severity, b: Severity): boolean {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b]
}

/**
 * Minimum severity for a manually raised deviation. The raiser may choose a higher
 * severity but never a lower one.
 */
export function severityForManual(category: DeviationCategory, unitsAffected: number): Severity {
  const unitsAtRisk = unitsAffected > 0
  switch (category) {
    case 'storage_temperature':
    case 'freezing':
      return unitsAtRisk ? 'critical' : 'major'
    case 'collection_bag':
      return 'major'
    case 'equipment':
      return unitsAtRisk ? 'major' : 'minor'
    default:
      return unitsAtRisk ? 'major' : 'minor'
  }
}

export function isOverdue(dueAt: string, now: string): boolean {
  return new Date(now).getTime() >= new Date(dueAt).getTime()
}

/** Includes tanks flagged for service before their deadline and in-use tanks overdue by date. */
export function isServiceDue(tank: Tank, now: string): boolean {
  return isInService(tank) && (tank.serviceStatus === 'due_service' || isOverdue(tank.nextServiceDue, now))
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function dueAtFor(severity: Severity, from: string, settings: RiskSettings): string {
  return addMinutes(from, settings.deadlineMinutes[severity])
}
