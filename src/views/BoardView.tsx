import { ActingAs } from '../components/ActingAs'
import { DeviationRegister } from '../components/DeviationRegister'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { RiskSettingsPanel } from '../components/RiskSettingsPanel'
import { LEVELS } from '../domain/escalation'
import { computeKris } from '../domain/kri'
import { DEFAULT_PERSON, getPerson, personName } from '../domain/people'
import { SETTINGS_ENTITY } from '../domain/settings'
import { LEVEL_LABEL } from '../lib/labels'
import { useAppState } from '../store/store'
import './BoardView.css'

const ACTOR = DEFAULT_PERSON.board

export function BoardView() {
  const state = useAppState()
  const k = computeKris(state)
  const maxLevel = Math.max(1, ...LEVELS.map((l) => k.openByLevel[l]))
  const lastSettingsChange = [...state.audit].reverse().find((a) => a.entityId === SETTINGS_ENTITY)

  return (
    <div className="board">
      <ActingAs role="board" personId={ACTOR} onChange={() => {}} />

      <section className="board__section">
        <h2>Key risk indicators</h2>
        <KpiRow>
          <KpiTile
            label="Tanks within limit"
            value={`${k.tanksInLimitPct}%`}
            sub={`${k.tanksInLimit} of ${k.monitoredTanks} monitored`}
            reg="Reg 8(2)(k)"
            tone={k.tanksInLimitPct < 100 ? 'crit' : 'ok'}
          />
          <KpiTile
            label="Tanks due for service in 14 days"
            value={`${k.serviceDueSoonPct}%`}
            sub={`${k.serviceDueSoon} of ${k.tanksInUse} in use`}
            reg="Reg 21(2)(g)"
            tone={k.serviceDueSoon ? 'warn' : 'ok'}
          />
          <KpiTile
            label="Open deviations"
            value={String(k.openDeviations)}
            sub={`${k.openCritical} critical`}
            reg="Reg 5(2)(a)"
            tone={k.openCritical ? 'crit' : k.openDeviations ? 'warn' : 'ok'}
          />
          <KpiTile
            label="Deviations resolved"
            value={`${k.resolvedPct}%`}
            sub={`${k.closedDeviations} closed`}
            reg="Reg 5(2)(b)"
            tone={k.resolvedPct < 50 ? 'warn' : 'ok'}
          />
          <KpiTile
            label="Missed escalation deadlines"
            value={String(k.missedDeadlines)}
            sub={`${k.overdueNow} overdue now`}
            reg="Reg 8(2)(k)"
            tone={k.missedDeadlines ? 'crit' : 'ok'}
          />
          <KpiTile
            label="Pushed to MOH"
            value={String(k.mohNotified)}
            sub="Critical deviations at Board level"
            tone={k.mohNotified ? 'crit' : 'ok'}
          />
        </KpiRow>
      </section>

      <div className="board__grid">
        <section className="board__card">
          <h3>Open deviations by escalation level</h3>
          <ul className="bars">
            {LEVELS.map((l) => (
              <li key={l}>
                <span className="bars__label">{LEVEL_LABEL[l]}</span>
                <span className="bars__track">
                  <span
                    className={`bars__fill bars__fill--${l}`}
                    style={{ width: `${(k.openByLevel[l] / maxLevel) * 100}%` }}
                  />
                </span>
                <span className="bars__value mono">{k.openByLevel[l]}</span>
              </li>
            ))}
          </ul>
          <h3>Age of open deviations</h3>
          <ul className="ageing">
            {k.ageing.map((a) => (
              <li key={a.label}>
                <span className="mono">{a.count}</span>
                <span>{a.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="board__card">
          <h3>Downgrade and dismissal requests by person</h3>
          <p className="board__note">
            A person who often asks to downgrade or dismiss deviations is a warning sign for under-reporting (Reg 7(3)).
          </p>
          {k.changeRequests.length === 0 ? (
            <p className="board__empty">No requests yet.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Requests</th>
                  <th>Approved</th>
                  <th>Rejected</th>
                </tr>
              </thead>
              <tbody>
                {k.changeRequests.map((r) => (
                  <tr key={r.personId}>
                    <td>
                      {personName(r.personId)}
                      <span className="mini-table__sub">{getPerson(r.personId)?.title}</span>
                    </td>
                    <td className="mono">{r.requested}</td>
                    <td className="mono">{r.approved}</td>
                    <td className="mono">{r.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <DeviationRegister role="board" actorId={ACTOR} />

      <RiskSettingsPanel
        key={JSON.stringify(state.settings)}
        settings={state.settings}
        actorId={ACTOR}
        lastChange={lastSettingsChange}
      />
    </div>
  )
}
