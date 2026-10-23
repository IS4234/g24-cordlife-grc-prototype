import { personName } from '../domain/people'
import type { Deviation } from '../domain/types'
import { formatDue } from '../lib/format'
import { CATEGORY_LABEL, DEVIATION_STATUS, LEVEL_LABEL, SEVERITY } from '../lib/labels'
import { Pill } from './Pill'
import './DeviationTable.css'

interface DeviationTableProps {
  deviations: Deviation[]
  now: string
  onSelect: (id: string) => void
}

export function DeviationTable({ deviations, now, onSelect }: DeviationTableProps) {
  if (deviations.length === 0) {
    return <p className="dev-empty">No deviations match this filter.</p>
  }

  return (
    <div className="dev-table-wrap">
      <table className="dev-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Deviation</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Level</th>
            <th>Owner</th>
            <th>Next escalation</th>
          </tr>
        </thead>
        <tbody>
          {deviations.map((d) => {
            const due = formatDue(d.dueAt, now)
            const closed = d.status === 'closed'
            return (
              <tr key={d.id} onClick={() => onSelect(d.id)}>
                <td>
                  <button type="button" className="dev-table__id mono" onClick={() => onSelect(d.id)}>
                    {d.id}
                  </button>
                </td>
                <td className="dev-table__title">
                  <span>{d.title}</span>
                  <span className="dev-table__sub">
                    {CATEGORY_LABEL[d.category]}
                    {d.tankId && ` · ${d.tankId}`}
                    {d.source === 'sensor' && ' · auto-raised'}
                  </span>
                </td>
                <td>
                  <Pill tone={SEVERITY[d.severity].tone}>{SEVERITY[d.severity].label}</Pill>
                </td>
                <td>
                  {d.dismissed ? (
                    <Pill tone="neutral">Dismissed</Pill>
                  ) : (
                    <Pill tone={DEVIATION_STATUS[d.status].tone}>{DEVIATION_STATUS[d.status].label}</Pill>
                  )}
                  {d.pendingChange && <span className="dev-table__flag">Change requested</span>}
                </td>
                <td>
                  <span className="dev-table__level">
                    {LEVEL_LABEL[d.escalationLevel]}
                    {d.mohNotifiedAt && <span className="dev-table__moh">MOH notified</span>}
                  </span>
                </td>
                <td>{d.ownerId ? personName(d.ownerId) : <span className="dev-table__none">Unassigned</span>}</td>
                <td className={!closed && due.overdue ? 'dev-table__due dev-table__due--late' : 'dev-table__due'}>
                  {closed ? '—' : due.text}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
