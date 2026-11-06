import { useState } from 'react'
import { DeviationRegister } from '../components/DeviationRegister'
import { Drawer } from '../components/Drawer'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { SeverityPill } from '../components/Severity'
import { TankCard } from '../components/TankCard'
import { TankDetail } from '../components/TankDetail'
import { activeSensorDeviations, isActive } from '../domain/deviations'
import { DEFAULT_PERSON } from '../domain/people'
import { BREACH_LIMIT_C, isMonitored, tempStatus } from '../domain/rules'
import { formatDateTime } from '../lib/format'
import { restoreCooling, restoreProbeFeed, returnTankToService, verifyProbeMapping } from '../store/actions'
import { useAppState } from '../store/store'
import './OperatorView.css'

export function OperatorView() {
  const state = useAppState()
  const { tanks, settings, deviations } = state
  const [openTankId, setOpenTankId] = useState<string | null>(null)
  const openTank = tanks.find((t) => t.id === openTankId)

  const monitored = tanks.filter(isMonitored)
  const inLimit = monitored.filter((t) => tempStatus(t, settings) !== 'breach').length
  const breaches = monitored.length - inLimit
  const serviceDue = tanks.filter((t) => t.serviceStatus === 'due_service').length
  const active = deviations.filter(isActive)
  const alerts = active
    .filter((d) => d.severity === 'critical')
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))

  return (
    <div className="operator">
      <KpiRow>
        <KpiTile label="Tanks within limit" value={`${inLimit} / ${monitored.length}`} tone={breaches ? 'crit' : 'ok'} />
        <KpiTile label="Tanks in breach" value={String(breaches)} tone={breaches ? 'crit' : 'ok'} />
        <KpiTile label="Open deviations" value={String(active.length)} tone={active.length ? 'warn' : 'ok'} />
        <KpiTile label="Tanks due for service" value={String(serviceDue)} tone={serviceDue ? 'warn' : 'ok'} />
      </KpiRow>

      {alerts.length > 0 && (
        <section className="alerts" aria-label="Critical alerts">
          {alerts.map((d) => (
            <div key={d.id} className="alert" role="alert">
              <SeverityPill severity={d.severity} />
              <span className="alert__text">
                <span className="mono">{d.id}</span> {d.title}
              </span>
              <span className="alert__time mono">Raised {formatDateTime(d.raisedAt)}</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Storage tanks</h2>
          <span className="section-head__meta">
            Limit {BREACH_LIMIT_C} °C · warning above {settings.warningC} °C
          </span>
        </div>
        <div className="tank-grid">
          {tanks.map((t) => (
            <TankCard
              key={t.id}
              tank={t}
              settings={settings}
              now={state.simTime}
              deviations={activeSensorDeviations(state, t.id)}
              onRestore={() => restoreCooling(t.id, DEFAULT_PERSON.operator)}
              onVerifyProbe={() => verifyProbeMapping(t.id, DEFAULT_PERSON.operator)}
              onReturnToService={() => returnTankToService(t.id, DEFAULT_PERSON.operator)}
              onRestoreProbe={() => restoreProbeFeed(t.id, DEFAULT_PERSON.operator)}
              onOpen={() => setOpenTankId(t.id)}
            />
          ))}
        </div>
      </section>

      <DeviationRegister role="operator" actorId={DEFAULT_PERSON.operator} canRaise />

      {openTank && (
        <Drawer title={openTank.id} onClose={() => setOpenTankId(null)}>
          <TankDetail tank={openTank} state={state} actorId={DEFAULT_PERSON.operator} />
        </Drawer>
      )}
    </div>
  )
}
