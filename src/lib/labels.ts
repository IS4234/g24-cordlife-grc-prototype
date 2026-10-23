import type { TempStatus } from '../domain/rules'
import type { DeviationCategory, DeviationStatus, EscalationLevel, ServiceStatus, Severity } from '../domain/types'

export const CATEGORY_LABEL: Record<DeviationCategory, string> = {
  storage_temperature: 'Storage temperature',
  collection_bag: 'Collection bag / supplier',
  freezing: 'Freezing / processing',
  equipment: 'Equipment',
  other: 'Other',
}

export type Tone = 'ok' | 'warn' | 'crit' | 'neutral' | 'brand'

export const SERVICE_LABEL: Record<ServiceStatus, string> = {
  in_service: 'In service',
  due_service: 'Service due',
  servicing: 'Being serviced',
  not_in_use: 'Not in use',
}

export const TEMP_STATUS: Record<TempStatus, { label: string; tone: Tone }> = {
  ok: { label: 'Within limit', tone: 'ok' },
  warning: { label: 'Warning', tone: 'warn' },
  breach: { label: 'Breach', tone: 'crit' },
  offline: { label: 'Not monitored', tone: 'neutral' },
}

export const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  critical: { label: 'Critical', tone: 'crit' },
  major: { label: 'Major', tone: 'warn' },
  minor: { label: 'Minor', tone: 'neutral' },
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
