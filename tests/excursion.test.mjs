import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeExcursion, excursionSummary } from '../src/domain/excursion.ts'
import { createSeedState } from '../src/domain/seed.ts'
import { advanceMinutes } from '../src/domain/simulation.ts'
import { ongoingCondition } from '../src/domain/tankChecks.ts'

const changeTank = (s, changes) => ({ ...s, tanks: s.tanks.map((t) => t.id === 'T-07' ? { ...t, ...changes } : t) })
const incident = (s) => s.deviations.find((d) => d.tankId === 'T-07' && d.trigger === 'breach')
const summary = (s) => excursionSummary(incident(s), s.simTime)

for (const restoreCooling of [true, false]) {
  test(`probe outage preserves unknown exposure when readings resume ${restoreCooling ? 'below' : 'above'} the limit`, (t) => {
    t.mock.method(Math, 'random', () => 0.5)
    let s = advanceMinutes(changeTank(createSeedState(), { fault: 'ln2_failure' }), 45)
    const before = summary(s)
    assert.ok(before.minutes > 0)
    assert.equal(before.ongoing, true)
    assert.equal(before.unknownMinutes, 0)
    assert.equal(incident(s).mohNotifiedAt !== undefined, true)

    s = advanceMinutes(changeTank(s, { probeOffline: true, ...(restoreCooling ? { fault: undefined } : {}) }), 60)
    const offline = summary(s)
    assert.equal(offline.minutes, before.minutes)
    assert.equal(offline.peakC, before.peakC)
    assert.equal(offline.unknownMinutes, 60)
    assert.equal(offline.unknownOngoing, true)
    assert.equal(offline.ongoing, false)
    assert.ok(ongoingCondition(s, incident(s)))
    assert.match(describeExcursion(offline), /confirmed; 1 h unknown and counting, observed peak/)
    assert.equal(incident(s).excursions[0].endedAt, undefined)

    // Only the next actual reading can confirm recovery or continued breach.
    s = advanceMinutes(changeTank(s, { probeOffline: false }), 1)
    const resumed = summary(s)
    assert.equal(resumed.minutes, before.minutes)
    assert.equal(resumed.unknownMinutes, 61)
    assert.equal(resumed.unknownOngoing, false)
    assert.equal(resumed.ongoing, !restoreCooling)
    assert.equal(incident(s).excursions.length, 1)
    assert.notEqual(incident(s).status, 'closed')
    if (restoreCooling) {
      assert.equal(ongoingCondition(s, incident(s)), null)
      const audit = s.audit.findLast((a) => a.entityId === incident(s).id && a.action === 'deviation.excursion_ended')
      assert.match(audit.detail, /confirmed; 1 h 1 min unknown/)
    }
    s = advanceMinutes(s, 2)
    assert.equal(summary(s).minutes, before.minutes + (restoreCooling ? 0 : 2))
    assert.equal(summary(s).unknownMinutes, 61)
  })
}
