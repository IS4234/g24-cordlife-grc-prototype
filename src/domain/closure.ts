import { SEVERITY } from '../lib/labels'
import { withAudit } from './audit'
import { isActive, updateDeviation } from './deviations'
import { getPerson, personName } from './people'
import { dueAtFor } from './rules'
import type { AppState, Deviation, Person, Severity } from './types'

// Segregation of duties for closing, downgrading and dismissing deviations.
// These rules are what stop a single officer from deciding that a deviation "is not a concern".

const MIN_TEXT = 10

/** QA reports to the Board's Audit and Risk Committee, so QA and the Board are independent of Clinical Governance */
export function isIndependent(p: Person | undefined): boolean {
  return p?.line === 'quality_assurance' || p?.line === 'board'
}

function canGovern(p: Person | undefined): boolean {
  return p?.role === 'cgo' || p?.role === 'board'
}

export function requiredApprovals(severity: Severity): number {
  return severity === 'minor' ? 1 : 2
}

export function needsIndependentApprover(severity: Severity): boolean {
  return severity === 'critical'
}

export interface Requirement {
  label: string
  met: boolean
}

export function closureRequirements(d: Deviation): Requirement[] {
  const n = requiredApprovals(d.severity)
  const reqs: Requirement[] = [
    { label: 'Root cause recorded', met: (d.rootCause?.trim().length ?? 0) >= MIN_TEXT },
    { label: 'Corrective and preventive action recorded', met: (d.capa?.trim().length ?? 0) >= MIN_TEXT },
    { label: 'At least one piece of evidence attached', met: d.evidence.length > 0 },
    { label: `${n} approval${n > 1 ? 's' : ''} from people other than the raiser and submitter`, met: d.approvals.length >= n },
  ]
  if (needsIndependentApprover(d.severity)) {
    reqs.push({
      label: 'At least one independent approver (QA or Board)',
      met: d.approvals.some((a) => isIndependent(getPerson(a.personId))),
    })
  }
  return reqs
}

/** Returns why this person cannot approve the closure, or null if they can */
export function approvalBlocker(d: Deviation, personId: string): string | null {
  const p = getPerson(personId)
  if (d.status !== 'pending_closure') return 'This deviation is not awaiting closure.'
  if (!canGovern(p)) return 'Only Clinical Governance, QA or the Board can approve closures.'
  if (personId === d.raisedBy) return 'The person who raised a deviation cannot approve its closure.'
  if (personId === d.submittedBy) return 'The person who submitted the investigation cannot approve it.'
  if (d.approvals.some((a) => a.personId === personId)) return 'You have already approved this closure.'
  const remaining = requiredApprovals(d.severity) - d.approvals.length
  const hasIndependent = d.approvals.some((a) => isIndependent(getPerson(a.personId)))
  if (needsIndependentApprover(d.severity) && remaining === 1 && !hasIndependent && !isIndependent(p)) {
    return 'The final approval for a critical deviation must come from QA or the Board.'
  }
  return null
}

export interface ClosureSubmission {
  rootCause: string
  capa: string
  newEvidence: string[]
}

export function submissionErrors(d: Deviation, input: ClosureSubmission): string[] {
  const errors: string[] = []
  if (input.rootCause.trim().length < MIN_TEXT) errors.push('Describe the root cause (at least 10 characters).')
  if (input.capa.trim().length < MIN_TEXT) errors.push('Describe the corrective and preventive action.')
  if (d.evidence.length + input.newEvidence.length === 0) errors.push('Attach at least one piece of evidence.')
  return errors
}

export function submitForClosure(s: AppState, id: string, actorId: string, input: ClosureSubmission): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || !isActive(d) || d.pendingChange || !canGovern(getPerson(actorId))) return s
  if (submissionErrors(d, input).length) return s

  const next = updateDeviation(s, id, (cur) => ({
    ...cur,
    rootCause: input.rootCause.trim(),
    capa: input.capa.trim(),
    evidence: [...cur.evidence, ...input.newEvidence],
    submittedBy: actorId,
    status: 'pending_closure',
    approvals: [],
  }))
  return withAudit(next, {
    actorId,
    action: 'deviation.submitted',
    entityId: id,
    detail: `Submitted root cause and CAPA for closure (${requiredApprovals(d.severity)} approvals required)`,
  })
}

export function approveClosure(s: AppState, id: string, personId: string, note?: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || approvalBlocker(d, personId)) return s

  const approvals = [...d.approvals, { personId, at: s.simTime, note: note?.trim() || undefined }]
  const updated = { ...d, approvals }
  const done = closureRequirements(updated).every((r) => r.met)

  let next = updateDeviation(s, id, () => (done ? { ...updated, status: 'closed', closedAt: s.simTime } : updated))
  next = withAudit(next, {
    actorId: personId,
    action: 'deviation.approved',
    entityId: id,
    detail: `Approved closure (${approvals.length} of ${requiredApprovals(d.severity)})${note?.trim() ? `: ${note.trim()}` : ''}`,
  })
  if (done) {
    next = withAudit(next, {
      actorId: personId,
      action: 'deviation.closed',
      entityId: id,
      detail: `Closed with root cause, CAPA and approvals from ${approvals.map((a) => personName(a.personId)).join(' and ')}`,
    })
  }
  return next
}

export function rejectClosure(s: AppState, id: string, personId: string, reason: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || d.status !== 'pending_closure' || !canGovern(getPerson(personId)) || reason.trim().length < MIN_TEXT) {
    return s
  }
  const next = updateDeviation(s, id, (cur) => ({ ...cur, status: 'investigating', approvals: [] }))
  return withAudit(next, {
    actorId: personId,
    action: 'deviation.closure_rejected',
    entityId: id,
    detail: `Sent back for further investigation: ${reason.trim()}`,
  })
}

// ── Downgrade and dismissal ──────────────────────────────────────────────

export function requestChange(
  s: AppState,
  id: string,
  actorId: string,
  kind: 'downgrade' | 'dismiss',
  reason: string,
  to?: Severity,
): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d || !isActive(d) || d.pendingChange || !canGovern(getPerson(actorId))) return s
  if (reason.trim().length < MIN_TEXT || (kind === 'downgrade' && !to)) return s

  const next = updateDeviation(s, id, (cur) => ({
    ...cur,
    pendingChange: { kind, to, requestedBy: actorId, reason: reason.trim(), at: s.simTime },
  }))
  const what = kind === 'dismiss' ? 'dismissal' : `downgrade from ${SEVERITY[d.severity].label} to ${SEVERITY[to!].label}`
  return withAudit(next, {
    actorId,
    action: 'deviation.change_requested',
    entityId: id,
    detail: `Requested ${what}: ${reason.trim()}. Needs a second approver before it takes effect.`,
  })
}

export function changeBlocker(d: Deviation, personId: string): string | null {
  const p = getPerson(personId)
  if (!d.pendingChange) return 'There is no pending request.'
  if (!canGovern(p)) return 'Only Clinical Governance, QA or the Board can decide on this request.'
  if (personId === d.pendingChange.requestedBy) return 'A different person must approve this request.'
  if (d.severity === 'critical' && !isIndependent(p)) {
    return 'Downgrading or dismissing a critical deviation needs approval from QA or the Board.'
  }
  return null
}

export function approveChange(s: AppState, id: string, personId: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d?.pendingChange || changeBlocker(d, personId)) return s
  const req = d.pendingChange
  const who = `Requested by ${personName(req.requestedBy)}, approved by ${personName(personId)}`

  if (req.kind === 'dismiss') {
    const next = updateDeviation(s, id, (cur) => ({
      ...cur,
      pendingChange: undefined,
      status: 'closed',
      dismissed: true,
      closedAt: s.simTime,
    }))
    return withAudit(next, {
      actorId: personId,
      action: 'deviation.dismissed',
      entityId: id,
      detail: `Dismissed. ${who}. Reason: ${req.reason}`,
    })
  }

  const to = req.to!
  const next = updateDeviation(s, id, (cur) => ({
    ...cur,
    pendingChange: undefined,
    severity: to,
    dueAt: dueAtFor(to, s.simTime, s.settings),
  }))
  return withAudit(next, {
    actorId: personId,
    action: 'deviation.downgraded',
    entityId: id,
    detail: `Severity lowered from ${SEVERITY[d.severity].label} to ${SEVERITY[to].label}. ${who}. Reason: ${req.reason}`,
  })
}

export function rejectChange(s: AppState, id: string, personId: string): AppState {
  const d = s.deviations.find((x) => x.id === id)
  if (!d?.pendingChange || changeBlocker(d, personId)) return s
  const next = updateDeviation(s, id, (cur) => ({ ...cur, pendingChange: undefined }))
  return withAudit(next, {
    actorId: personId,
    action: 'deviation.change_rejected',
    entityId: id,
    detail: `Rejected request from ${personName(d.pendingChange.requestedBy)} to ${d.pendingChange.kind} this deviation`,
  })
}
