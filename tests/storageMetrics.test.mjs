import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeKris } from '../src/domain/kri.ts'
import { createSeedState } from '../src/domain/seed.ts'
import { detectTankIssues } from '../src/domain/tankChecks.ts'

for (const tankId of ['T-09', 'T-11']) {
  test(`${tankId} holding units counts as unknown storage and immediately notifies MOH`, () => {
    const seed = createSeedState()
    seed.tanks = seed.tanks.map((tank) => tank.id === tankId
      // Even a fresh, verified safe reading cannot establish monitored storage while inactive.
      ? { ...tank, cbuCount: 420, tempC: -190, probeVerified: true, lastReadingAt: seed.simTime }
      : tank)
    const state = detectTankIssues(seed)
    const k = computeKris(state)

    assert.equal(k.tanksHoldingUnits, 11)
    assert.equal(k.tanksInLimit, 10)
    assert.equal(k.tanksUnknown, 1)
    assert.equal(k.tanksInLimitPct, 91)
    const alert = state.deviations.find((d) => d.tankId === tankId && d.trigger === 'unmonitored_units')
    assert.equal(alert?.severity, 'critical')
    assert.equal(alert?.mohNotifiedAt, state.simTime)
  })
}
