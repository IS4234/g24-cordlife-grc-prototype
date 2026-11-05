import { BREACH_LIMIT_C, isInService, isOverdue, tempStatus } from '../domain/rules'
import type { Deviation, RiskSettings, Tank } from '../domain/types'
import { formatDateTime } from '../lib/format'
import { SERVICE_LABEL, TEMP_STATUS, TRIGGER_LABEL } from '../lib/labels'
import { Pill } from './Pill'
import { Sparkline } from './Sparkline'
import './TankCard.css'

interface TankCardProps {
  tank: Tank
  settings: RiskSettings
  now: string
  /** Open system-raised deviations for this tank */
  deviations: Deviation[]
  onRestore: () => void
  onVerifyProbe: () => void
  onReturnToService: () => void
}

export function TankCard({ tank, settings, now, deviations, onRestore, onVerifyProbe, onReturnToService }: TankCardProps) {
  const status = tempStatus(tank, settings)
  const { label, tone } = TEMP_STATUS[status]
  const fill = Math.round((tank.cbuCount / tank.capacity) * 100)

  return (
    <article className={`tank tank--${status}`}>
      <header className="tank__head">
        <div>
          <h3 className="tank__id">{tank.id}</h3>
          <span className="tank__loc">{tank.location}</span>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </header>

      <div className="tank__temp">
        <span className="tank__value mono">{tank.tempC.toFixed(1)}</span>
        <span className="tank__unit">°C</span>
        <span className="tank__limit">limit {BREACH_LIMIT_C} °C</span>
      </div>

      <Sparkline values={tank.history} thresholdC={BREACH_LIMIT_C} tone={tone} />

      <dl className="tank__facts">
        <div>
          <dt>Units stored</dt>
          <dd>
            <span className="mono">{tank.cbuCount.toLocaleString()}</span>
            <span className="tank__bar" aria-hidden="true">
              <span style={{ width: `${fill}%` }} />
            </span>
          </dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{SERVICE_LABEL[tank.serviceStatus]}</dd>
        </div>
        <div>
          <dt>Next service</dt>
          <dd className={isInService(tank) && isOverdue(tank.nextServiceDue, now) ? 'mono tank__overdue' : 'mono'}>
            {formatDateTime(tank.nextServiceDue)}
          </dd>
        </div>
      </dl>

      {!tank.probeVerified && <p className="tank__note tank__note--warn">Probe mapping not verified</p>}
      {deviations.map((d) => (
        <p key={d.id} className={`tank__note tank__note--${d.severity === 'critical' ? 'crit' : 'warn'}`}>
          <span className="mono">{d.id}</span> raised automatically: {TRIGGER_LABEL[d.trigger ?? 'breach']}
        </p>
      ))}
      {(tank.fault || tank.serviceStatus === 'servicing') && (
        <div className="tank__actions">
          {tank.fault && (
            <button type="button" className="btn btn--small" onClick={onRestore}>
              Restore LN2 supply
            </button>
          )}
          {tank.serviceStatus === 'servicing' && !tank.probeVerified && (
            <button type="button" className="btn btn--small" onClick={onVerifyProbe}>
              Verify probe mapping
            </button>
          )}
          {tank.serviceStatus === 'servicing' && (
            <button type="button" className="btn btn--ghost btn--small" onClick={onReturnToService}>
              Return to service
            </button>
          )}
        </div>
      )}
    </article>
  )
}
