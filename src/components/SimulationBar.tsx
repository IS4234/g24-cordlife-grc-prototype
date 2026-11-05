import { useState } from 'react'
import { isMonitored } from '../domain/rules'
import { SPEEDS, type Speed, useSimulation } from '../hooks/useSimulation'
import { advanceClock, injectUnmonitoredUnits, injectWarmingFault } from '../store/actions'
import { useAppState } from '../store/store'
import './SimulationBar.css'

export function SimulationBar() {
  const { tanks } = useAppState()
  const { running, setRunning, speed, setSpeed } = useSimulation()
  const candidates = tanks.filter((t) => isMonitored(t) && !t.fault)
  const [faultTank, setFaultTank] = useState('T-07')
  const selected = candidates.some((t) => t.id === faultTank) ? faultTank : (candidates[0]?.id ?? '')
  // Only an empty tank under maintenance can be used to show units left unmonitored
  const gapTank = tanks.find((t) => t.serviceStatus === 'servicing' && t.cbuCount === 0)

  return (
    <section className="sim" aria-label="Demo controls">
      <span className="sim__label">Demo controls</span>

      <div className="sim__group">
        <button type="button" className="btn btn--small" onClick={() => setRunning(!running)}>
          {running ? 'Pause feed' : 'Start feed'}
        </button>
        <label className="sim__field">
          <span>Speed</span>
          <select
            id="sim-speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s} min / sec
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => advanceClock(15)}>
          +15 min
        </button>
      </div>

      <div className="sim__group">
        <label className="sim__field">
          <span>Simulate LN2 failure</span>
          <select id="sim-fault-tank" value={selected} onChange={(e) => setFaultTank(e.target.value)}>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={!selected}
          onClick={() => injectWarmingFault(selected)}
        >
          Start warming
        </button>
      </div>

      {gapTank && (
        <div className="sim__group">
          <span className="sim__field">Simulate monitoring gap</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => injectUnmonitoredUnits(gapTank.id)}>
            Leave units in {gapTank.id}
          </button>
        </div>
      )}
    </section>
  )
}
