import { useState } from 'react'
import {
  approvalBlocker,
  changeBlocker,
  closureRequirements,
  type Requirement,
  submissionErrors,
} from '../domain/closure'
import { getPerson, personName } from '../domain/people'
import { atLeast } from '../domain/rules'
import type { Deviation, Severity } from '../domain/types'
import { formatDateTime } from '../lib/format'
import { SEVERITY } from '../lib/labels'
import {
  approveDeviationClosure,
  decideDeviationChange,
  rejectDeviationClosure,
  requestDeviationChange,
  submitClosure,
} from '../store/actions'
import './ClosurePanels.css'

interface PanelProps {
  deviation: Deviation
  actorId: string
}

function Checklist({ items }: { items: Requirement[] }) {
  return (
    <ul className="checklist">
      {items.map((r) => (
        <li key={r.label} className={r.met ? 'checklist__item checklist__item--met' : 'checklist__item'}>
          <span className="checklist__mark" aria-hidden="true">
            {r.met ? '✓' : ''}
          </span>
          {r.label}
          <span className="visually-hidden">{r.met ? ' (met)' : ' (not met)'}</span>
        </li>
      ))}
    </ul>
  )
}

function Blocked({ message }: { message: string }) {
  return (
    <p className="blocked" role="status">
      <strong>Blocked by control:</strong> {message}
    </p>
  )
}

export function SubmitClosurePanel({ deviation: d, actorId }: PanelProps) {
  const [rootCause, setRootCause] = useState(d.rootCause ?? '')
  const [capa, setCapa] = useState(d.capa ?? '')
  const [evidence, setEvidence] = useState('')
  const input = { rootCause, capa, newEvidence: evidence.trim() ? [evidence.trim()] : [] }
  const errors = submissionErrors(d, input)

  return (
    <section className="panel">
      <span className="panel__title">Submit investigation for closure</span>
      <p className="panel__text">
        Closing needs a root cause, a CAPA and evidence, then independent approval. You cannot approve your own
        submission.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          submitClosure(d.id, actorId, input)
        }}
      >
        <label className="field">
          Root cause
          <textarea id="close-root-cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
        </label>
        <label className="field">
          Corrective and preventive action (CAPA)
          <textarea id="close-capa" value={capa} onChange={(e) => setCapa(e.target.value)} />
        </label>
        <label className="field">
          Add evidence
          <span className="field__hint">{d.evidence.length} already attached</span>
          <input
            id="close-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="e.g. Viability test results T-07 sample.pdf"
          />
        </label>
        {errors.length > 0 && (
          <ul className="form-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div>
          <button type="submit" className="btn btn--small" disabled={errors.length > 0}>
            Submit for approval
          </button>
        </div>
      </form>
    </section>
  )
}

export function ApprovalPanel({ deviation: d, actorId }: PanelProps) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const blocker = approvalBlocker(d, actorId)

  return (
    <section className="panel panel--highlight">
      <span className="panel__title">Closure approval</span>
      <p className="panel__text">Submitted by {d.submittedBy ? personName(d.submittedBy) : 'unknown'}.</p>
      <Checklist items={closureRequirements(d)} />

      {d.approvals.length > 0 && (
        <ul className="approvals">
          {d.approvals.map((a) => (
            <li key={a.personId}>
              <strong>{personName(a.personId)}</strong> ({getPerson(a.personId)?.title}) approved at{' '}
              <span className="mono">{formatDateTime(a.at)}</span>
              {a.note && <span className="approvals__note">“{a.note}”</span>}
            </li>
          ))}
        </ul>
      )}

      {blocker ? (
        <Blocked message={blocker} />
      ) : (
        <label className="field">
          Approval note (optional)
          <input id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}

      <div className="panel__actions">
        <button
          type="button"
          className="btn btn--small"
          disabled={!!blocker}
          onClick={() => {
            approveDeviationClosure(d.id, actorId, note)
            setNote('')
          }}
        >
          Approve closure
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setRejecting(!rejecting)}>
          Send back
        </button>
      </div>

      {rejecting && (
        <RejectForm
          label="Why is the investigation not sufficient?"
          onSubmit={(reason) => {
            rejectDeviationClosure(d.id, actorId, reason)
            setRejecting(false)
          }}
        />
      )}
    </section>
  )
}

function RejectForm({ label, onSubmit }: { label: string; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(reason)
      }}
    >
      <label className="field">
        {label}
        <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div>
        <button type="submit" className="btn btn--small" disabled={reason.trim().length < 10}>
          Send back for investigation
        </button>
      </div>
    </form>
  )
}

const SEVERITIES: Severity[] = ['minor', 'major', 'critical']

export function ChangeRequestPanel({ deviation: d, actorId }: PanelProps) {
  const lower = SEVERITIES.filter((s) => s !== d.severity && atLeast(d.severity, s))
  const [choice, setChoice] = useState<string>('dismiss')
  const [reason, setReason] = useState('')

  return (
    <section className="panel">
      <span className="panel__title">Downgrade or dismiss</span>
      <p className="panel__text">
        This creates a request only. A second person must approve it
        {d.severity === 'critical' ? ', and for a critical deviation that person must be from QA or the Board' : ''}.
        Every request is counted in the Board's KRIs.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (choice === 'dismiss') requestDeviationChange(d.id, actorId, 'dismiss', reason)
          else requestDeviationChange(d.id, actorId, 'downgrade', reason, choice as Severity)
          setReason('')
        }}
      >
        <label className="field">
          Request
          <select id="change-kind" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="dismiss">Dismiss as not a concern</option>
            {lower.map((s) => (
              <option key={s} value={s}>
                Lower severity to {SEVERITY[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Justification
          <textarea id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div>
          <button type="submit" className="btn btn--ghost btn--small" disabled={reason.trim().length < 10}>
            Submit request
          </button>
        </div>
      </form>
    </section>
  )
}

export function PendingChangePanel({ deviation: d, actorId }: PanelProps) {
  const req = d.pendingChange!
  const blocker = changeBlocker(d, actorId)
  const what =
    req.kind === 'dismiss' ? 'dismiss this deviation' : `lower severity to ${SEVERITY[req.to!].label}`

  return (
    <section className="panel panel--warn">
      <span className="panel__title">Pending request</span>
      <p className="panel__text">
        <strong>{personName(req.requestedBy)}</strong> asked to {what} at{' '}
        <span className="mono">{formatDateTime(req.at)}</span>.
      </p>
      <blockquote className="request-reason">{req.reason}</blockquote>
      <p className="panel__text">Escalation deadlines keep running while the request is pending.</p>
      {blocker && <Blocked message={blocker} />}
      <div className="panel__actions">
        <button
          type="button"
          className="btn btn--small"
          disabled={!!blocker}
          onClick={() => decideDeviationChange(d.id, actorId, true)}
        >
          Approve request
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={!!blocker}
          onClick={() => decideDeviationChange(d.id, actorId, false)}
        >
          Reject request
        </button>
      </div>
    </section>
  )
}
