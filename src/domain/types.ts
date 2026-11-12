import type { RoleId } from '../roles'

export type ServiceStatus = 'in_service' | 'due_service' | 'servicing' | 'not_in_use'

export interface Tank {
  id: string
  location: string
  capacity: number
  cbuCount: number
  /** Latest probe reading in °C */
  tempC: number
  /** Simulated physical temperature. Differs from tempC only while the probe is offline. */
  actualTempC: number
  serviceStatus: ServiceStatus
  lastServicedAt: string
  nextServiceDue: string
  /** False after maintenance until the probe-to-tank mapping is verified */
  probeVerified: boolean
  /** When the probe last reported a reading */
  lastReadingAt: string
  /** Demo-only: the probe has stopped reporting, so readings freeze */
  probeOffline?: boolean
  /** Recent readings, one per simulated minute, oldest first */
  history: number[]
  /** Liquid nitrogen fill level, 0 to 100 */
  ln2LevelPct: number
  lastCalibratedAt: string
  /** Probes are calibrated against a reference thermometer once a year */
  calibrationDue: string
  /** Demo-only fault injected by the simulator: the LN2 supply stops refilling the tank */
  fault?: 'ln2_failure'
}

export type Severity = 'minor' | 'major' | 'critical'

/** The tank condition that made the system raise a deviation */
export type SensorTrigger =
  | 'breach'
  | 'unmonitored_units'
  | 'probe_unverified'
  | 'service_overdue'
  | 'ln2_low'
  | 'temp_warning'
  | 'calibration_overdue'
  | 'probe_offline'

export type DeviationStatus = 'open' | 'investigating' | 'escalated' | 'pending_closure' | 'closed'

export type DeviationCategory = 'storage_temperature' | 'collection_bag' | 'freezing' | 'equipment' | 'other'

/** Escalation ladder, lowest to highest */
export type EscalationLevel = 'operator' | 'cgo' | 'board' | 'moh'

export interface Approval {
  personId: string
  at: string
  note?: string
}

/** A request to lower severity or dismiss a deviation. Never applied without a second person. */
export interface ChangeRequest {
  kind: 'downgrade' | 'dismiss'
  to?: Severity
  requestedBy: string
  reason: string
  at: string
}

/** One stretch of time a tank spent above the breach limit */
export interface Excursion {
  startedAt: string
  /** Missing while the tank is still above the limit */
  endedAt?: string
  peakC: number
}

export interface Deviation {
  id: string
  title: string
  description: string
  source: 'sensor' | 'manual'
  /** For system-raised deviations, the condition that raised it */
  trigger?: SensorTrigger
  category: DeviationCategory
  tankId?: string
  /** Units that may be affected, used by the manual severity rule */
  unitsAffected?: number
  severity: Severity
  status: DeviationStatus
  escalationLevel: EscalationLevel
  raisedBy: string
  raisedAt: string
  /** When the deviation escalates to the next level if still unresolved */
  dueAt: string
  ownerId?: string
  rootCause?: string
  capa?: string
  evidence: string[]
  approvals: Approval[]
  /** Who submitted the root cause and CAPA for closure */
  submittedBy?: string
  pendingChange?: ChangeRequest
  /** Closed through an approved dismissal rather than a completed investigation */
  dismissed?: boolean
  closedAt?: string
  /** Set when the deviation is pushed to the regulator */
  mohNotifiedAt?: string
  mohAcknowledgedAt?: string
  /** For storage incidents, each time the tank went above the breach limit */
  excursions?: Excursion[]
}

export interface AuditEntry {
  id: string
  at: string
  /** Person id, or 'system' for automated actions */
  actorId: string
  action: string
  entityId: string
  detail: string
}

/** Board-approved risk appetite. Deadlines are in simulated minutes. */
export interface RiskSettings {
  warningC: number
  deadlineMinutes: Record<Severity, number>
  /** Additional severities pushed to MOH at the Board; critical deviations notify MOH immediately */
  mohNotifySeverity: Severity
}

export interface Person {
  id: string
  name: string
  title: string
  role: RoleId
  /** Reporting line, used to check approver independence */
  line: 'operations' | 'clinical_governance' | 'quality_assurance' | 'board' | 'regulator'
}

export interface AppState {
  version: number
  /** Simulated clock, ISO string */
  simTime: string
  tanks: Tank[]
  deviations: Deviation[]
  audit: AuditEntry[]
  settings: RiskSettings
  nextDeviationSeq: number
  nextAuditSeq: number
}
