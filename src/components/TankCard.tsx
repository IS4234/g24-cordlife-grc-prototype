import { tempStatus } from '../domain/rules'
import type { Deviation, RiskSettings, Tank } from '../domain/types'
import { formatDateTime } from '../lib/format'
import { SERVICE_LABEL, TEMP_STATUS } from '../lib/labels'
import { Pill } from './Pill'
import { Sparkline } from './Sparkline'
import './TankCard.css'

interface TankCardProps {
  tank: Tank
  settings: RiskSettings
  deviation?: Deviation
  onRestore: () => void
}

export function TankCard({ tank, settings, deviation, onRestore }: TankCardProps) {
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
        <span className="tank__limit">limit {settings.thresholdC} °C</span>
      </div>

      <Sparkline values={tank.history} thresholdC={settings.thresholdC} tone={tone === 'brand' ? 'ok' : tone} />

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
          <dd className="mono">{formatDateTime(tank.nextServiceDue)}</dd>
        </div>
      </dl>

      {!tank.probeVerified && <p className="tank__note tank__note--warn">Probe mapping not verified</p>}
      {deviation && (
        <p className="tank__note tank__note--crit">
          <span className="mono">{deviation.id}</span> raised automatically
        </p>
      )}
      {tank.fault && (
        <button type="button" className="btn btn--small tank__action" onClick={onRestore}>
          Restore LN2 supply
        </button>
      )}
    </article>
  )
}
