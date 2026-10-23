import { useState } from 'react'
import { isActive } from '../domain/deviations'
import { levelsAbove } from '../domain/escalation'
import { PEOPLE, personName } from '../domain/people'
import type { AppState, Deviation, EscalationLevel } from '../domain/types'
import { formatDateTime, formatDue } from '../lib/format'
import { CATEGORY_LABEL, DEVIATION_STATUS, LEVEL_LABEL, SEVERITY } from '../lib/labels'
import type { RoleId } from '../roles'
import { assignDeviation, escalateDeviation } from '../store/actions'
import { ApprovalPanel, ChangeRequestPanel, PendingChangePanel, SubmitClosurePanel } from './ClosurePanels'
import { Pill } from './Pill'
import './DeviationDetail.css'

interface DeviationDetailProps {
  deviation: Deviation
  state: AppState
  role: RoleId
  actorId: string
}

export function DeviationDetail({ deviation: d, state, role, actorId }: DeviationDetailProps) {
  const active = isActive(d)
  const governs = role === 'cgo' || role === 'board'
  const due = formatDue(d.dueAt, state.simTime)
  const timeline = state.audit.filter((a) => a.entityId === d.id).reverse()

  return (
    <>
      <div className="detail__pills">
        <Pill tone={SEVERITY[d.severity].tone}>{SEVERITY[d.severity].label}</Pill>
        <Pill tone={DEVIATION_STATUS[d.status].tone}>{DEVIATION_STATUS[d.status].label}</Pill>
        {d.dismissed && <Pill tone="neutral">Dismissed</Pill>}
        {d.pendingChange && <Pill tone="warn">Change requested</Pill>}
        {d.mohNotifiedAt && <Pill tone="crit">MOH notified</Pill>}
      </div>

      <div className="detail__intro">
        <h3>{d.title}</h3>
        <p>{d.description}</p>
      </div>

      <dl className="detail__facts">
        <Fact label="Category" value={CATEGORY_LABEL[d.category]} />
        {d.tankId && <Fact label="Tank" value={d.tankId} />}
        {d.unitsAffected !== undefined && <Fact label="Units affected" value={d.unitsAffected.toLocaleString()} />}
        <Fact label="Raised by" value={`${personName(d.raisedBy)}${d.source === 'sensor' ? ' (sensor rule)' : ''}`} />
        <Fact label="Raised" value={formatDateTime(d.raisedAt)} />
        <Fact label="Escalation level" value={LEVEL_LABEL[d.escalationLevel]} />
        <Fact label="Owner" value={d.ownerId ? personName(d.ownerId) : 'Unassigned'} />
        {active && (
          <Fact
            label={d.escalationLevel === 'moh' ? 'Response due' : 'Next escalation'}
            value={`${formatDateTime(d.dueAt)} (${due.text})`}
            late={due.overdue}
          />
        )}
        {d.closedAt && <Fact label="Closed" value={formatDateTime(d.closedAt)} />}
      </dl>

      {d.evidence.length > 0 && (
        <section className="detail__section">
          <h4>Evidence</h4>
          <ul className="detail__evidence">
            {d.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {(d.rootCause || d.capa) && (
        <section className="detail__section">
          <h4>Investigation</h4>
          <dl className="detail__facts detail__facts--stacked">
            {d.rootCause && <Fact label="Root cause" value={d.rootCause} />}
            {d.capa && <Fact label="Corrective and preventive action" value={d.capa} />}
          </dl>
        </section>
      )}

      {active && governs && d.pendingChange && <PendingChangePanel key={`chg-${d.id}`} deviation={d} actorId={actorId} />}
      {active && governs && d.status === 'pending_closure' && (
        <ApprovalPanel key={`appr-${d.id}`} deviation={d} actorId={actorId} />
      )}
      {active && role === 'cgo' && d.status !== 'pending_closure' && (
        <AssignPanel key={`assign-${d.id}`} deviation={d} actorId={actorId} />
      )}
      {active && governs && !d.pendingChange && d.status !== 'pending_closure' && (
        <>
          <SubmitClosurePanel key={`submit-${d.id}`} deviation={d} actorId={actorId} />
          <ChangeRequestPanel key={`req-${d.id}`} deviation={d} actorId={actorId} />
        </>
      )}
      {active && role !== 'moh' && levelsAbove(d.escalationLevel).length > 0 && (
        <EscalatePanel deviation={d} actorId={actorId} />
      )}

      <section className="detail__section">
        <h4>Audit trail</h4>
        <ol className="timeline">
          {timeline.map((a) => (
            <li key={a.id}>
              <span className="timeline__meta mono">
                {formatDateTime(a.at)} · {personName(a.actorId)}
              </span>
              <span>{a.detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function Fact({ label, value, late }: { label: string; value: string; late?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={late ? 'detail__late' : undefined}>{value}</dd>
    </div>
  )
}

function AssignPanel({ deviation, actorId }: { deviation: Deviation; actorId: string }) {
  const investigators = PEOPLE.filter((p) => p.role === 'cgo')
  const [ownerId, setOwnerId] = useState(deviation.ownerId ?? investigators[0].id)

  return (
    <section className="panel">
      <span className="panel__title">Assign investigation owner</span>
      <div className="detail__inline">
        <select id="assign-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {investigators.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--small"
          disabled={ownerId === deviation.ownerId}
          onClick={() => assignDeviation(deviation.id, ownerId, actorId)}
        >
          Assign
        </button>
      </div>
    </section>
  )
}

function EscalatePanel({ deviation, actorId }: { deviation: Deviation; actorId: string }) {
  const targets = levelsAbove(deviation.escalationLevel)
  const [to, setTo] = useState<EscalationLevel>(targets[0])
  const [reason, setReason] = useState('')
  const target = targets.includes(to) ? to : targets[0]

  return (
    <section className="panel">
      <span className="panel__title">Escalate</span>
      <p className="panel__text">
        Anyone can escalate past their line manager, straight to the Board or MOH if needed. A reason is required and
        recorded in the audit trail.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          escalateDeviation(deviation.id, target, actorId, reason)
          setReason('')
        }}
      >
        <label className="field">
          Escalate to
          <select id="escalate-to" value={target} onChange={(e) => setTo(e.target.value as EscalationLevel)}>
            {targets.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Reason
          <textarea
            id="escalate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Told this was not a concern, but units may be damaged"
          />
        </label>
        <div>
          <button type="submit" className="btn btn--small" disabled={reason.trim().length < 5}>
            Escalate to {LEVEL_LABEL[target]}
          </button>
        </div>
      </form>
    </section>
  )
}
