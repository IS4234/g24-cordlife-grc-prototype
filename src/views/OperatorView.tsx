import { Pill } from '../components/Pill'
import { TankCard } from '../components/TankCard'
import { activeSensorDeviation, isActive } from '../domain/deviations'
import { DEFAULT_PERSON } from '../domain/people'
import { isMonitored, tempStatus } from '../domain/rules'
import { formatDateTime } from '../lib/format'
import { SEVERITY } from '../lib/labels'
import { restoreCooling } from '../store/actions'
import { useAppState } from '../store/store'
import './OperatorView.css'

export function OperatorView() {
  const state = useAppState()
  const { tanks, settings, deviations } = state

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
      <div className="kpis">
        <Kpi label="Tanks within limit" value={`${inLimit} / ${monitored.length}`} tone={breaches ? 'crit' : 'ok'} />
        <Kpi label="Tanks in breach" value={String(breaches)} tone={breaches ? 'crit' : 'ok'} />
        <Kpi label="Open deviations" value={String(active.length)} tone={active.length ? 'warn' : 'ok'} />
        <Kpi label="Tanks due for service" value={String(serviceDue)} tone={serviceDue ? 'warn' : 'ok'} />
      </div>

      {alerts.length > 0 && (
        <section className="alerts" aria-label="Critical alerts">
          {alerts.map((d) => (
            <div key={d.id} className="alert" role="alert">
              <Pill tone={SEVERITY[d.severity].tone}>{SEVERITY[d.severity].label}</Pill>
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
            Limit {settings.thresholdC} °C · warning above {settings.warningC} °C
          </span>
        </div>
        <div className="tank-grid">
          {tanks.map((t) => (
            <TankCard
              key={t.id}
              tank={t}
              settings={settings}
              deviation={activeSensorDeviation(state, t.id)}
              onRestore={() => restoreCooling(t.id, DEFAULT_PERSON.operator)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'crit' }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value mono">{value}</span>
    </div>
  )
}
