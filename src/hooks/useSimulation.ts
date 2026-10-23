import { useEffect, useState } from 'react'
import { advanceClock } from '../store/actions'

/** Simulated minutes that pass per real second */
export const SPEEDS = [1, 5, 15] as const
export type Speed = (typeof SPEEDS)[number]

// Running state is per tab, so only the tab where Play was pressed advances the shared clock
export function useSimulation() {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => advanceClock(speed), 1000)
    return () => window.clearInterval(id)
  }, [running, speed])

  return { running, setRunning, speed, setSpeed }
}
