import type { MouseEvent } from 'react'
import { excursionSummary } from '../domain/excursion'
import {
  BREACH_LIMIT_C,
  isInService,
  isOverdue,
  LN2_LOW_PCT,
  PROBE_STALE_MIN,
  readingAgeMin,
  tempStatus,
} from '../domain/rules'
import type { Deviation, RiskSettings, Tank } from '../domain/types'
import { formatAgo, formatDateTime, formatSpan } from '../lib/format'
import { SERVICE_LABEL, tankBadge, TRIGGER_LABEL } from '../lib/labels'
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
  onRestoreProbe: () => void
  onOpen: () => void
}

/** LN2 fill bar; turns amber below the refill level */
export function Ln2Bar({ level, wide }: { level: number; wide?: boolean }) {
  const low = level < LN2_LOW_PCT
  return (
    <span className={`tank__bar${wide ? ' tank__bar--wide' : ''}${low ? ' tank__bar--low' : ''}`} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, level))}%` }} />
    </span>
  )
}

function excursionText(d: Deviation, now: string): string {
  const x = excursionSummary(d, now)
  if (!x) return ''
  return x.ongoing ? ` · above limit for ${formatSpan(x.minutes)}` : ` · ${formatSpan(x.minutes)} above limit`
}

// Buttons inside the card act on their own, without also opening the detail drawer
const own = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

export function TankCard(props: TankCardProps) {
  const { tank, settings, now, deviations, onRestore, onVerifyProbe, onReturnToService, onRestoreProbe, onOpen } = props
  const age = readingAgeMin(tank, now)
  const freshness = age >= PROBE_STALE_MIN ? 'crit' : age >= 2 ? 'warn' : 'ok'
  const status = tempStatus(tank, settings)
  const { label, tone } = tankBadge(tank, settings, now)
  const fill = Math.round((tank.cbuCount / tank.capacity) * 100)

  return (
    <article className={`tank tank--${status}`} onClick={onOpen}>
      <header className="tank__head">
        <div>
          <h3 className="tank__id">
            <button type="button" className="tank__open" onClick={own(onOpen)} aria-label={`${tank.id} details`}>
              {tank.id}
            </button>
          </h3>
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
          <dt>LN2 level</dt>
          <dd className={tank.serviceStatus !== 'not_in_use' && tank.ln2LevelPct < LN2_LOW_PCT ? 'tank__low' : undefined}>
            <span className="mono">{Math.round(tank.ln2LevelPct)}%</span>
            <Ln2Bar level={tank.ln2LevelPct} />
          </dd>
        </div>
        <div>
          <dt>Last reading</dt>
          {tank.serviceStatus === 'not_in_use' ? (
            <dd className="tank__muted">No live feed</dd>
          ) : (
            <dd className={`tank__fresh tank__fresh--${freshness}`}>{formatAgo(tank.lastReadingAt, now)}</dd>
          )}
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
          {excursionText(d, now)}
        </p>
      ))}
      {(tank.fault ||
        tank.probeOffline ||
        tank.serviceStatus === 'servicing' ||
        (!tank.probeVerified && tank.serviceStatus !== 'not_in_use') ||
        status === 'empty') && (
        <div className="tank__actions">
          {tank.fault && (
            <button type="button" className="btn btn--small" onClick={own(onRestore)}>
              Restore LN2 supply
            </button>
          )}
          {tank.probeOffline && (
            <button type="button" className="btn btn--small" onClick={own(onRestoreProbe)}>
              Restore probe feed
            </button>
          )}
          {/* Available whenever mapping is unverified, including after an early return to service */}
          {!tank.probeVerified && tank.serviceStatus !== 'not_in_use' && (
            <button type="button" className="btn btn--small" onClick={own(onVerifyProbe)}>
              Verify probe mapping
            </button>
          )}
          {tank.serviceStatus === 'servicing' && (
            <button type="button" className="btn btn--ghost btn--small" onClick={own(onReturnToService)}>
              Return to service
            </button>
          )}
          {status === 'empty' && (
            <button type="button" className="btn btn--small" onClick={own(onOpen)}>
              Load units
            </button>
          )}
        </div>
      )}
    </article>
  )
}
