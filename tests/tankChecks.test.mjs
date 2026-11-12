import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approveClosure, submitForClosure } from '../src/domain/closure.ts'
import { createSeedState } from '../src/domain/seed.ts'
import { advanceMinutes } from '../src/domain/simulation.ts'
import { detectTankIssues } from '../src/domain/tankChecks.ts'

const investigation = {
  rootCause: 'LN2 supply interruption.',
  capa: 'Restored LN2 supply and checked tank temperature.',
  newEvidence: [],
}

function changeTank(s, changes, tankId = 'T-07') {
  return { ...s, tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, ...changes } : t)) }
}

function deviation(s, tankId = 'T-07') {
  const d = s.deviations.find((item) => item.source === 'sensor' && item.tankId === tankId)
  assert.ok(d, `Expected a sensor deviation for ${tankId}`)
  return d
}

function awaitingClosure(t, faultMinutes = 30, approve = true) {
  t.mock.method(Math, 'random', () => 0.5)
  let s = advanceMinutes(changeTank(createSeedState(), { fault: 'ln2_failure' }), faultMinutes)
  s = advanceMinutes(changeTank(s, { fault: undefined }), 15)
  const id = deviation(s).id
  s = submitForClosure(s, id, 'p-rachel', investigation)
  assert.equal(deviation(s).status, 'pending_closure')
  return approve ? approveClosure(s, id, 'p-daniel') : s
}

function invalidations(s, id = deviation(s).id) {
  return s.audit.filter((a) => a.entityId === id && a.action === 'deviation.closure_invalidated')
}

function assertInvalidated(s, tankId = 'T-07') {
  const d = deviation(s, tankId)
  assert.ok(['investigating', 'escalated'].includes(d.status), `Unexpected status: ${d.status}`)
  assert.deepEqual(d.approvals, [])
  assert.equal(d.submittedBy, undefined)
  assert.equal(d.rootCause, investigation.rootCause)
  assert.equal(d.capa, investigation.capa)
  assert.equal(invalidations(s, d.id).length, 1)
}

test('original PoC requires resubmission and two fresh approvals after a critical breach', (t) => {
  let s = awaitingClosure(t)
  const id = deviation(s).id
  const oldApprovalAt = deviation(s).approvals[0].at
  s = advanceMinutes(changeTank(s, { fault: 'ln2_failure' }), 45)
  assert.equal(deviation(s).severity, 'critical')
  assertInvalidated(s)
  s = advanceMinutes(changeTank(s, { fault: undefined }), 15)

  // This was enough to close the incident before the fix.
  assert.strictEqual(approveClosure(s, id, 'p-helen'), s)
  assertInvalidated(s)
  assert.ok(s.audit.some((a) => a.entityId === id && a.action === 'deviation.approved' && a.at === oldApprovalAt))

  s = submitForClosure(s, id, 'p-rachel', {
    rootCause: 'Recurring supply fault caused a temperature breach.',
    capa: 'Replaced supply equipment and assessed affected units.',
    newEvidence: ['Post-breach investigation report.pdf'],
  })
  s = approveClosure(s, id, 'p-daniel')
  assert.equal(deviation(s).status, 'pending_closure')
  assert.equal(deviation(s).approvals.length, 1)
  assert.notEqual(deviation(s).approvals[0].at, oldApprovalAt)
  s = approveClosure(s, id, 'p-helen')
  assert.equal(deviation(s).status, 'closed')
  assert.equal(deviation(s).approvals.length, 2)
})

test('a warning-stage upgrade invalidates closure even when severity remains major', (t) => {
  let s = awaitingClosure(t)
  s = changeTank(s, { fault: 'ln2_failure' })
  for (let minute = 0; minute < 45 && deviation(s).trigger !== 'temp_warning'; minute++) {
    s = advanceMinutes(s, 1)
  }
  assert.equal(deviation(s).trigger, 'temp_warning')
  assert.equal(deviation(s).severity, 'major')
  assertInvalidated(s)
})

test('a recurring LN2 condition invalidates closure without a stage or severity upgrade', (t) => {
  let s = awaitingClosure(t)
  s = advanceMinutes(changeTank(s, { fault: 'ln2_failure' }), 20)
  assert.equal(deviation(s).trigger, 'ln2_low')
  assert.equal(deviation(s).severity, 'major')
  assertInvalidated(s)
})

test('a second critical excursion invalidates closure on an existing critical incident', (t) => {
  let s = awaitingClosure(t, 45)
  assert.equal(deviation(s).severity, 'critical')
  s = advanceMinutes(changeTank(s, { fault: 'ln2_failure' }), 45)
  assert.equal(deviation(s).severity, 'critical')
  assert.equal(deviation(s).excursions.length, 2)
  assertInvalidated(s)
})

test('a non-storage condition that returns with higher severity invalidates closure', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  let s = detectTankIssues(changeTank(createSeedState(), { serviceStatus: 'in_service' }, 'T-09'))
  const id = deviation(s, 'T-09').id
  assert.equal(deviation(s, 'T-09').severity, 'major')
  s = changeTank(s, { probeVerified: true }, 'T-09')
  s = submitForClosure(s, id, 'p-rachel', { ...investigation, newEvidence: ['Probe check.pdf'] })
  s = approveClosure(s, id, 'p-daniel')
  s = detectTankIssues(changeTank(s, { probeVerified: false, cbuCount: 420 }, 'T-09'))
  assert.equal(deviation(s, 'T-09').severity, 'critical')
  assertInvalidated(s, 'T-09')
})

test('recurrence also invalidates a submission that has no approvals yet', (t) => {
  let s = awaitingClosure(t, 30, false)
  s = advanceMinutes(changeTank(s, { fault: 'ln2_failure' }), 20)
  assertInvalidated(s)
})

test('a missed deadline preserves the submission and approvals when the condition stays clear', (t) => {
  let s = awaitingClosure(t)
  const before = deviation(s)
  const minutesToDeadline = (Date.parse(before.dueAt) - Date.parse(s.simTime)) / 60_000
  s = advanceMinutes(s, minutesToDeadline)
  const after = deviation(s)
  assert.equal(after.escalationLevel, 'cgo')
  assert.equal(after.status, 'pending_closure')
  assert.deepEqual(after.approvals, before.approvals)
  assert.equal(after.submittedBy, before.submittedBy)
  assert.equal(invalidations(s).length, 0)
  s = approveClosure(s, after.id, 'p-helen')
  assert.equal(deviation(s).status, 'closed')
})

test('cleared sensor conditions do not invalidate manual deviation submissions', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  let s = createSeedState()
  const id = 'DEV-2026-001'
  s = submitForClosure(s, id, 'p-rachel', investigation)
  s = approveClosure(s, id, 'p-daniel')
  const before = s.deviations.find((d) => d.id === id)
  s = advanceMinutes(s, 15)
  assert.deepEqual(s.deviations.find((d) => d.id === id), before)
  assert.equal(invalidations(s, id).length, 0)
})
