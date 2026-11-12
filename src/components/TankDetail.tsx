import { useState } from 'react'
import { sortForRegister } from '../domain/deviations'
import { personName } from '../domain/people'
import {
  BREACH_LIMIT_C,
  isInService,
  isOverdue,
  LN2_LOW_PCT,
  loadBlockReason,
  PROBE_STALE_MIN,
  readingAgeMin,
} from '../domain/rules'
import type { AppState, Tank } from '../domain/types'
import { formatAgo, formatDate, formatDateTime } from '../lib/format'
import { DEVIATION_STATUS, SERVICE_LABEL, tankBadge } from '../lib/labels'
import { loadUnits, recordCalibration, recordService, verifyProbeMapping } from '../store/actions'
import { Ln2Bar } from './TankCard'
import { Pill } from './Pill'
import { SeverityPill } from './Severity'
import './TankDetail.css'

interface TankDetailProps {
  tank: Tank
  state: AppState
  actorId: string
}

export function TankDetail({ tank, state, actorId }: TankDetailProps) {
  const status = tankBadge(tank, state.settings, state.simTime)
  const inUse = isInService(tank)
  const calibrationLate = inUse && isOverdue(tank.calibrationDue, state.simTime)
  const serviceLate = inUse && isOverdue(tank.nextServiceDue, state.simTime)
  const deviations = sortForRegister(state.deviations.filter((d) => d.tankId === tank.id))
  const history = state.audit.filter((a) => a.entityId === tank.id).reverse()

  return (
    <>
      <div className="detail__pills">
        <Pill tone={status.tone}>{status.label}</Pill>
        <Pill tone="neutral">{SERVICE_LABEL[tank.serviceStatus]}</Pill>
      </div>

      <dl className="detail__facts">
        <Fact label="Temperature" value={`${tank.tempC.toFixed(1)} °C (limit ${BREACH_LIMIT_C} °C)`} />
        <Fact label="Location" value={tank.location} />
        <Fact
          label="Units stored"
          value={`${tank.cbuCount.toLocaleString()} of ${tank.capacity.toLocaleString()}`}
        />
      </dl>

      {tank.serviceStatus !== 'not_in_use' && <LoadUnitsForm key={tank.id} tank={tank} state={state} actorId={actorId} />}

      <section className="detail__section">
        <h4>Liquid nitrogen</h4>
        <div className="tank-detail__ln2">
          <Ln2Bar level={tank.ln2LevelPct} wide />
          <span className="mono">{Math.round(tank.ln2LevelPct)}%</span>
        </div>
        <p className="tank-detail__hint">
          A deviation is raised below {LN2_LOW_PCT}%. With too little nitrogen the tank starts to warm.
        </p>
      </section>

      <section className="detail__section">
        <h4>Probe</h4>
        <dl className="detail__facts">
          <Fact
            label="Last reading"
            value={
              tank.serviceStatus === 'not_in_use'
                ? 'No live feed'
                : `${formatDateTime(tank.lastReadingAt)} (${formatAgo(tank.lastReadingAt, state.simTime)})`
            }
            late={inUse && readingAgeMin(tank, state.simTime) >= PROBE_STALE_MIN}
          />
          <Fact label="Mapping" value={tank.probeVerified ? 'Verified' : 'Not verified'} late={!tank.probeVerified} />
          <Fact label="Last calibrated" value={formatDate(tank.lastCalibratedAt)} />
          <Fact
            label="Calibration due"
            value={`${formatDate(tank.calibrationDue)}${calibrationLate ? ' (overdue)' : ''}`}
            late={calibrationLate}
          />
        </dl>
        {tank.serviceStatus !== 'not_in_use' && (
          <div className="tank-detail__buttons">
            {!tank.probeVerified && (
              <button type="button" className="btn btn--small" onClick={() => verifyProbeMapping(tank.id, actorId)}>
                Verify probe mapping
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--small" onClick={() => recordCalibration(tank.id, actorId)}>
              Record calibration
            </button>
          </div>
        )}
      </section>

      <section className="detail__section">
        <h4>Service</h4>
        <dl className="detail__facts">
          <Fact label="Last serviced" value={formatDate(tank.lastServicedAt)} />
          <Fact
            label="Next service due"
            value={`${formatDate(tank.nextServiceDue)}${serviceLate ? ' (overdue)' : ''}`}
            late={serviceLate}
          />
        </dl>
        {inUse && (
          <div className="tank-detail__buttons">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => recordService(tank.id, actorId)}>
              Record service completed
            </button>
          </div>
        )}
      </section>

      <section className="detail__section">
        <h4>Deviations for this tank</h4>
        {deviations.length === 0 ? (
          <p className="tank-detail__hint">None recorded.</p>
        ) : (
          <ul className="tank-detail__devs">
            {deviations.map((d) => (
              <li key={d.id}>
                <span className="mono tank-detail__dev-id">{d.id}</span>
                <SeverityPill severity={d.severity} />
                <Pill tone={DEVIATION_STATUS[d.status].tone}>{DEVIATION_STATUS[d.status].label}</Pill>
                <span className="tank-detail__dev-title">{d.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail__section">
        <h4>Tank history</h4>
        {history.length === 0 ? (
          <p className="tank-detail__hint">No maintenance or calibration events recorded in this demo yet.</p>
        ) : (
          <ol className="timeline">
            {history.map((a) => (
              <li key={a.id}>
                <span className="timeline__meta mono">
                  {formatDateTime(a.at)} · {personName(a.actorId)}
                </span>
                <span>{a.detail}</span>
              </li>
            ))}
          </ol>
        )}
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

function LoadUnitsForm({ tank, state, actorId }: { tank: Tank; state: AppState; actorId: string }) {
  const spare = tank.capacity - tank.cbuCount
  const [count, setCount] = useState(Math.min(500, spare))
  const blocked = loadBlockReason(tank, state.settings, state.simTime)
  const valid = Number.isInteger(count) && count > 0 && count <= spare

  return (
    <section className="detail__section">
      <h4>Load units</h4>
      {blocked ? (
        <p className="tank-detail__blocked">{blocked}</p>
      ) : (
        <form
          className="tank-detail__load"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            loadUnits(tank.id, count, actorId)
            setCount(Math.min(500, spare - count))
          }}
        >
          <label className="field">
            Units to load
            <span className="field__hint">Up to {spare.toLocaleString()} more fit in this tank.</span>
            <input
              id="load-units-count"
              type="number"
              min={1}
              max={spare}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="btn btn--small" disabled={!valid}>
            Load units
          </button>
        </form>
      )}
    </section>
  )
}
