import type { RiskSettings, Severity, Tank } from './types'

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

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function dueAtFor(severity: Severity, from: string, settings: RiskSettings): string {
  return addMinutes(from, settings.deadlineMinutes[severity])
}
