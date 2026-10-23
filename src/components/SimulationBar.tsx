import { useState } from 'react'
import { isMonitored } from '../domain/rules'
import { SPEEDS, type Speed, useSimulation } from '../hooks/useSimulation'
import { advanceClock, injectWarmingFault } from '../store/actions'
import { useAppState } from '../store/store'
import './SimulationBar.css'

export function SimulationBar() {
  const { tanks } = useAppState()
  const { running, setRunning, speed, setSpeed } = useSimulation()
  const candidates = tanks.filter((t) => isMonitored(t) && !t.fault)
  const [faultTank, setFaultTank] = useState('T-07')
  const selected = candidates.some((t) => t.id === faultTank) ? faultTank : (candidates[0]?.id ?? '')

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
    </section>
  )
}
