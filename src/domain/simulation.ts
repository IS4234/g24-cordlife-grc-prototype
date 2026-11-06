import { applyDeadlines } from './escalation'
import { addMinutes, LN2_EMPTY_PCT } from './rules'
import { detectTankIssues } from './tankChecks'
import type { AppState, Tank } from './types'

export const HISTORY_LENGTH = 40

const WARMING_PER_MIN = 2.5
const RECOVERY_PER_MIN = 8
const AMBIENT_C = 22
const LN2_DRAIN_PER_MIN = 3
const LN2_REFILL_PER_MIN = 10

/** Each tank's auto-fill keeps it near its own normal LN2 level */
export function ln2BaselineFor(tankId: string): number {
  const n = Number(tankId.slice(2))
  return 72 + ((n * 7) % 20)
}

/** Each tank settles around a slightly different LN2 vapour-phase temperature */
export function baselineFor(tankId: string): number {
  const n = Number(tankId.slice(2))
  return -190 + ((n % 5) - 2) * 0.8
}

const round1 = (n: number) => Math.round(n * 10) / 10

function stepTank(tank: Tank, now: string): Tank {
  if (tank.serviceStatus === 'not_in_use') return tank

  // With the supply cut, LN2 boils off; otherwise auto-fill tops it back up to its normal level
  const fullLevel = ln2BaselineFor(tank.id)
  let level = tank.ln2LevelPct
  if (tank.fault === 'ln2_failure') level = Math.max(0, level - LN2_DRAIN_PER_MIN)
  else if (level < fullLevel - 1) level = Math.min(fullLevel, level + LN2_REFILL_PER_MIN)
  else level = Math.min(100, Math.max(0, level + (Math.random() - 0.5) * 0.6))
  level = round1(level)

  const base = baselineFor(tank.id)
  let temp = tank.tempC
  if (level < LN2_EMPTY_PCT) {
    // Without enough nitrogen the tank warms towards room temperature, never past it
    temp = Math.min(AMBIENT_C, temp + WARMING_PER_MIN + (Math.random() - 0.5) * 0.4)
  } else if (temp > base + 3) {
    temp = Math.max(base, temp - RECOVERY_PER_MIN)
  } else {
    temp += (base - temp) * 0.1 + (Math.random() - 0.5) * 0.6
  }
  temp = round1(temp)

  // An offline probe sends nothing, so the dashboard keeps its last reading and its age grows
  if (tank.probeOffline) return { ...tank, ln2LevelPct: level }
  return {
    ...tank,
    ln2LevelPct: level,
    tempC: temp,
    lastReadingAt: now,
    history: [...tank.history, temp].slice(-HISTORY_LENGTH),
  }
}

function stepMinute(s: AppState): AppState {
  const simTime = addMinutes(s.simTime, 1)
  const next = { ...s, simTime, tanks: s.tanks.map((t) => stepTank(t, simTime)) }
  return applyDeadlines(detectTankIssues(next))
}

export function advanceMinutes(s: AppState, minutes: number): AppState {
  let next = s
  for (let i = 0; i < minutes; i++) next = stepMinute(next)
  return next
}
