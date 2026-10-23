import type { AppState, AuditEntry } from './types'

/** Appends an audit entry. The log is append-only: there is no update or delete. */
export function withAudit(s: AppState, entry: Omit<AuditEntry, 'id' | 'at'> & { at?: string }): AppState {
  const id = `AUD-${String(s.nextAuditSeq).padStart(4, '0')}`
  return {
    ...s,
    audit: [...s.audit, { ...entry, id, at: entry.at ?? s.simTime }],
    nextAuditSeq: s.nextAuditSeq + 1,
  }
}
