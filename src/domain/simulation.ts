import { SYSTEM_ACTOR } from './people'
import { activeSensorDeviation, createDeviation } from './deviations'
import { applyDeadlines } from './escalation'
import { addMinutes, severityForBreach, tempStatus } from './rules'
import type { AppState, Tank } from './types'

export const HISTORY_LENGTH = 40

const WARMING_PER_MIN = 2.5
const RECOVERY_PER_MIN = 8
const AMBIENT_C = 22

/** Each tank settles around a slightly different LN2 vapour-phase temperature */
export function baselineFor(tankId: string): number {
  const n = Number(tankId.slice(2))
  return -190 + ((n % 5) - 2) * 0.8
}

const round1 = (n: number) => Math.round(n * 10) / 10

function stepTank(tank: Tank): Tank {
  if (tank.serviceStatus === 'not_in_use') return tank

  const base = baselineFor(tank.id)
  let temp = tank.tempC
  if (tank.fault === 'warming') {
    // A failed dewar warms towards room temperature, never past it
    temp = Math.min(AMBIENT_C, temp + WARMING_PER_MIN + (Math.random() - 0.5) * 0.4)
  } else if (temp > base + 3) {
    temp = Math.max(base, temp - RECOVERY_PER_MIN)
  } else {
    temp += (base - temp) * 0.1 + (Math.random() - 0.5) * 0.6
  }
  temp = round1(temp)

  return { ...tank, tempC: temp, history: [...tank.history, temp].slice(-HISTORY_LENGTH) }
}

/** Every breach opens a deviation. Nobody decides whether it exists. */
function detectBreaches(s: AppState): AppState {
  let next = s
  for (const tank of s.tanks) {
    if (tempStatus(tank, s.settings) !== 'breach') continue
    if (activeSensorDeviation(next, tank.id)) continue
    next = createDeviation(next, {
      title: `${tank.id} temperature above ${s.settings.thresholdC} °C`,
      description: `Probe reading of ${tank.tempC} °C exceeded the ${s.settings.thresholdC} °C limit. ${tank.cbuCount.toLocaleString()} cord blood units stored in this tank.`,
      source: 'sensor',
      category: 'storage_temperature',
      tankId: tank.id,
      severity: severityForBreach(tank),
      raisedBy: SYSTEM_ACTOR,
      evidence: [`Probe reading ${tank.tempC} °C at ${s.simTime}`],
    })
  }
  return next
}

function stepMinute(s: AppState): AppState {
  const next = { ...s, simTime: addMinutes(s.simTime, 1), tanks: s.tanks.map(stepTank) }
  return applyDeadlines(detectBreaches(next))
}

export function advanceMinutes(s: AppState, minutes: number): AppState {
  let next = s
  for (let i = 0; i < minutes; i++) next = stepMinute(next)
  return next
}
