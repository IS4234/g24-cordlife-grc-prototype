import type { RoleId } from '../roles'

export type ServiceStatus = 'in_service' | 'due_service' | 'servicing' | 'not_in_use'

export interface Tank {
  id: string
  location: string
  capacity: number
  cbuCount: number
  /** Latest probe reading in °C */
  tempC: number
  serviceStatus: ServiceStatus
  lastServicedAt: string
  nextServiceDue: string
  /** False after maintenance until the probe-to-tank mapping is verified */
  probeVerified: boolean
}

export type Severity = 'minor' | 'major' | 'critical'

export type DeviationStatus = 'open' | 'investigating' | 'escalated' | 'pending_closure' | 'closed'

export type DeviationCategory = 'storage_temperature' | 'collection_bag' | 'freezing' | 'equipment' | 'other'

/** Escalation ladder, lowest to highest */
export type EscalationLevel = 'operator' | 'cgo' | 'board' | 'moh'

export interface Approval {
  personId: string
  at: string
  note?: string
}

export interface Deviation {
  id: string
  title: string
  description: string
  source: 'sensor' | 'manual'
  category: DeviationCategory
  tankId?: string
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
  closedAt?: string
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
  thresholdC: number
  warningC: number
  deadlineMinutes: Record<Severity, number>
  /** Deviations at or above this severity are pushed to MOH as soon as they escalate to the Board */
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
