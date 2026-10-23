import type { DeviationCategory, RiskSettings, Severity, Tank } from './types'

export type TempStatus = 'ok' | 'warning' | 'breach' | 'offline'

/** A tank is monitored for breaches when it holds units and is in service */
export function isMonitored(tank: Tank): boolean {
  return tank.cbuCount > 0 && (tank.serviceStatus === 'in_service' || tank.serviceStatus === 'due_service')
}

export function tempStatus(tank: Tank, settings: RiskSettings): TempStatus {
  if (!isMonitored(tank)) return 'offline'
  if (tank.tempC > settings.thresholdC) return 'breach'
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

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function dueAtFor(severity: Severity, from: string, settings: RiskSettings): string {
  return addMinutes(from, settings.deadlineMinutes[severity])
}
