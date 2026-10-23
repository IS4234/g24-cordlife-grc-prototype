import { useState } from 'react'
import { resetDemo } from '../store/store'

export function ResetDemoButton() {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(true)}>
        Reset demo
      </button>
    )
  }

  return (
    <span className="reset-confirm">
      <span>Discard all changes?</span>
      <button
        type="button"
        className="btn btn--small"
        onClick={() => {
          resetDemo()
          setConfirming(false)
        }}
      >
        Reset
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  )
}
