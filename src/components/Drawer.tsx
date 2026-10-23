import { useEffect, type ReactNode } from 'react'
import './Drawer.css'

interface DrawerProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

export function Drawer({ title, onClose, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <header className="drawer__head">
          <h2 className="drawer__title">{title}</h2>
          <button type="button" className="drawer__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </div>
    </div>
  )
}
