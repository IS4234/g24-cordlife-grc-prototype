import assert from 'node:assert/strict'
import { test } from 'node:test'
import { submitForClosure } from '../src/domain/closure.ts'
import { addMinutes, isServiceDue } from '../src/domain/rules.ts'
import { ongoingCondition } from '../src/domain/tankChecks.ts'
import * as actions from '../src/store/actions.ts'
import { getState, resetDemo } from '../src/store/store.ts'

const investigation = {
  rootCause: 'Scheduled service was delayed.',
  capa: 'Completed overdue servicing and updated the maintenance schedule.',
  newEvidence: ['Completed service report T-08.pdf'],
}

test('recorded service clears the overdue blocker and allows closure with two approvals', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  resetDemo()
  actions.advanceClock(120)
  const before = getState()
  const tankBefore = before.tanks.find((tank) => tank.id === 'T-08')
  const deviation = before.deviations.find((d) => d.tankId === 'T-08' && d.trigger === 'service_overdue')
  assert.ok(deviation)
  assert.ok(ongoingCondition(before, deviation))
  assert.strictEqual(submitForClosure(before, deviation.id, 'p-rachel', investigation), before)

  actions.recordService('T-08', 'p-aisyah')
  const after = getState()
  assert.deepEqual(after.tanks.find((tank) => tank.id === 'T-08'), {
    ...tankBefore,
    serviceStatus: 'in_service',
    lastServicedAt: after.simTime,
    nextServiceDue: addMinutes(after.simTime, 90 * 1440),
  })
  assert.deepEqual(after.deviations, before.deviations)
  assert.equal(ongoingCondition(after, deviation), null)
  assert.equal(after.audit.length, before.audit.length + 1)
  assert.deepEqual(after.audit.at(-1), {
    id: `AUD-${String(before.nextAuditSeq).padStart(4, '0')}`,
    at: after.simTime,
    actorId: 'p-aisyah',
    action: 'tank.service_completed',
    entityId: 'T-08',
    detail: 'T-08 service completion recorded. Next service due in 90 days. Any linked deviation stays open for investigation.',
  })

  actions.advanceClock(15)
  assert.equal(getState().deviations.filter((d) => d.tankId === 'T-08' && d.trigger === 'service_overdue').length, 1)
  actions.submitClosure(deviation.id, 'p-rachel', investigation)
  assert.equal(getState().deviations.find((d) => d.id === deviation.id).status, 'pending_closure')
  actions.approveDeviationClosure(deviation.id, 'p-daniel')
  assert.equal(getState().deviations.find((d) => d.id === deviation.id).status, 'pending_closure')
  actions.approveDeviationClosure(deviation.id, 'p-helen')
  assert.equal(getState().deviations.find((d) => d.id === deviation.id).status, 'closed')
})

for (const tankId of ['T-01', 'T-04']) {
  test(`service can be recorded for an in-use tank (${tankId}) before its deadline`, () => {
    resetDemo()
    const before = getState()
    const tankBefore = before.tanks.find((tank) => tank.id === tankId)
    actions.recordService(tankId, 'p-aisyah')
    const after = getState()
    assert.deepEqual(after.tanks.find((tank) => tank.id === tankId), {
      ...tankBefore,
      serviceStatus: 'in_service',
      lastServicedAt: after.simTime,
      nextServiceDue: addMinutes(after.simTime, 90 * 1440),
    })
    assert.equal(after.audit.at(-1).entityId, tankId)
    assert.equal(after.audit.at(-1).action, 'tank.service_completed')
  })
}

for (const tankId of ['T-09', 'T-11', 'missing-tank']) {
  test(`recording service cannot return an inactive or missing tank to service (${tankId})`, () => {
    resetDemo()
    const before = getState()
    actions.recordService(tankId, 'p-aisyah')
    assert.strictEqual(getState(), before)
  })
}

test('service due includes the next deadline without counting inactive tanks', () => {
  resetDemo()
  actions.recordService('T-08', 'p-aisyah')
  const { tanks, simTime } = getState()
  const tank = tanks.find((t) => t.id === 'T-08')
  assert.equal(isServiceDue(tank, addMinutes(tank.nextServiceDue, -1)), false)
  assert.equal(isServiceDue(tank, tank.nextServiceDue), true)
  assert.equal(isServiceDue(tank, addMinutes(tank.nextServiceDue, 1)), true)
  assert.equal(isServiceDue({ ...tank, serviceStatus: 'due_service' }, simTime), true)
  for (const serviceStatus of ['servicing', 'not_in_use']) {
    assert.equal(isServiceDue({ ...tank, serviceStatus }, tank.nextServiceDue), false)
  }
})
