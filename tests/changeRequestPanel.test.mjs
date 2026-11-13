import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsxEmit, ModuleKind, transpileModule } from 'typescript'
import { decideDeviationChange, injectUnmonitoredUnits, requestDeviationChange } from '../src/store/actions.ts'
import { getState, resetDemo } from '../src/store/store.ts'

// Render the actual panel with a fixed store snapshot, using existing TypeScript/React dependencies.
const sourceUrl = new URL('../src/components/ClosurePanels.tsx', import.meta.url)
const require = createRequire(sourceUrl)
const { outputText } = transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { jsx: JsxEmit.ReactJSX, module: ModuleKind.CommonJS },
})
const panelModule = { exports: {} }
runInNewContext(outputText, {
  exports: panelModule.exports,
  require: (name) => name === '../store/store' ? { useAppState: getState }
    : name.endsWith('.css') ? {} : require(name.startsWith('.') ? `${name}.ts` : name),
})
const { PendingChangePanel } = panelModule.exports

test('an independent reviewer can reject an active dismissal while approval remains blocked', () => {
  resetDemo()
  injectUnmonitoredUnits('T-09')
  const id = getState().deviations.find((d) => d.trigger === 'unmonitored_units').id
  requestDeviationChange(id, 'p-rachel', 'dismiss', 'Please review this dismissal request.')
  const requested = getState()
  const deviation = requested.deviations.find((d) => d.id === id)
  const buttons = (actorId) => [...renderToStaticMarkup(createElement(PendingChangePanel, { deviation, actorId }))
    .matchAll(/<button([^>]*)>([^<]*)<\/button>/g)]
    .map(([, attributes, label]) => ({ label: label.trim(), disabled: /\bdisabled=/.test(attributes) }))

  assert.deepEqual(buttons('p-daniel'), [
    { label: 'Approve request', disabled: true },
    { label: 'Reject request', disabled: false },
  ])
  for (const actor of ['p-rachel', 'p-aisyah']) {
    assert.ok(buttons(actor).every((button) => button.disabled))
  }
  decideDeviationChange(id, 'p-daniel', true)
  assert.strictEqual(getState(), requested)
  decideDeviationChange(id, 'p-daniel', false)
  const rejected = getState().deviations.find((d) => d.id === id)
  assert.equal(rejected.pendingChange, undefined)
  assert.equal(rejected.status, 'open')
  assert.equal(getState().tanks.find((t) => t.id === 'T-09').serviceStatus, 'servicing')
  assert.equal(getState().audit.at(-1).action, 'deviation.change_rejected')
})
