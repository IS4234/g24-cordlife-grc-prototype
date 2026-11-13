import { isInService, isMonitored, PROBE_STALE_MIN, readingAgeMin, readingTrusted, tempStatus, type TempStatus } from '../domain/rules'
import type {
  AppState,
  Deviation,
  DeviationCategory,
  DeviationStatus,
  EscalationLevel,
  SensorTrigger,
  RiskSettings,
  ServiceStatus,
  Severity,
  Tank,
} from '../domain/types'

export const CATEGORY_LABEL: Record<DeviationCategory, string> = {
  storage_temperature: 'Storage temperature',
  collection_bag: 'Collection bag / supplier',
  freezing: 'Freezing / processing',
  equipment: 'Equipment',
  other: 'Other',
}

export type Tone = 'ok' | 'warn' | 'crit' | 'neutral' | 'brand' | 'minor'

export const SERVICE_LABEL: Record<ServiceStatus, string> = {
  in_service: 'In service',
  due_service: 'Service due',
  servicing: 'Being serviced',
  not_in_use: 'Not in use',
}

export const TEMP_STATUS: Record<TempStatus, { label: string; tone: 'ok' | 'warn' | 'crit' | 'neutral' }> = {
  ok: { label: 'Within limit', tone: 'ok' },
  warning: { label: 'Warning', tone: 'warn' },
  breach: { label: 'Breach', tone: 'crit' },
  empty: { label: 'Empty', tone: 'neutral' },
  offline: { label: 'Not monitored', tone: 'neutral' },
}

// Meanings mirror the severity rules in domain/rules.ts
export const SEVERITY: Record<Severity, { label: string; tone: Tone; meaning: string }> = {
  critical: {
    label: 'Critical',
    tone: 'crit',
    meaning: 'Stored cord blood units are at risk, e.g. a storage or freezing failure affecting units.',
  },
  major: {
    label: 'Major',
    tone: 'warn',
    meaning: 'Could affect units or quality, e.g. a supplier defect, or a storage issue with no units yet affected.',
  },
  minor: {
    label: 'Minor',
    tone: 'minor',
    meaning: 'No units affected. An equipment or process gap to record and fix.',
  },
}

export const DEVIATION_STATUS: Record<DeviationStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'brand' },
  investigating: { label: 'Investigating', tone: 'brand' },
  escalated: { label: 'Escalated', tone: 'crit' },
  pending_closure: { label: 'Pending closure', tone: 'warn' },
  closed: { label: 'Closed', tone: 'ok' },
}

export const LEVEL_LABEL: Record<EscalationLevel, string> = {
  operator: 'Operations',
  cgo: 'Clinical Governance',
  board: 'Board',
  moh: 'MOH',
}

export const TRIGGER_LABEL: Record<SensorTrigger, string> = {
  breach: 'temperature breach',
  unmonitored_units: 'units not monitored',
  probe_unverified: 'probe not verified',
  service_overdue: 'service overdue',
  ln2_low: 'LN2 level low',
  temp_warning: 'temperature warning',
  calibration_overdue: 'calibration overdue',
  probe_offline: 'probe offline',
}

/** The status badge. A silent probe means the last reading can't be trusted, so it shows "No data" */
export function tankBadge(tank: Tank, settings: RiskSettings, now: string): (typeof TEMP_STATUS)[TempStatus] {
  if (isInService(tank) && readingAgeMin(tank, now) >= PROBE_STALE_MIN) {
    return { label: 'No data', tone: 'crit' }
  }
  // The reading might belong to another tank, so don't present it as this tank's status
  if (isInService(tank) && !tank.probeVerified) return { label: 'Unverified', tone: 'warn' }
  return TEMP_STATUS[tempStatus(tank, settings)]
}

/** Keep open monitoring incidents visible without presenting cleared conditions as ongoing. */
export function operatorAlertTitle(d: Deviation, state: AppState): string {
  if (d.source !== 'sensor') return d.title
  const tank = state.tanks.find((t) => t.id === d.tankId)
  if (!tank) return d.title
  if (d.trigger === 'probe_unverified' && tank.probeVerified) {
    return `${tank.id} probe mapping verified — incident awaiting closure`
  }
  return d.trigger === 'unmonitored_units' && isMonitored(tank) && readingTrusted(tank, state.simTime)
    ? `${tank.id} monitoring restored — incident awaiting closure`
    : d.title
}
