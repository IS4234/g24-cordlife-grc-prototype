import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { DEFAULT_ROLE, getRole, type RoleId } from './roles'
import { useAppState } from './store/store'

function App() {
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE)
  const state = useAppState()

  return (
    <AppShell role={role} onRoleChange={setRole}>
      {/* Temporary data check; replaced by role-specific views in the next steps */}
      <p>
        {getRole(role).label} view coming soon. Loaded {state.tanks.length} tanks, {state.deviations.length} deviations
        and {state.audit.length} audit entries.
      </p>
    </AppShell>
  )
}

export default App
