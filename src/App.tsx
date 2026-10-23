import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { DEFAULT_ROLE, getRole, type RoleId } from './roles'

function App() {
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE)

  return (
    <AppShell role={role} onRoleChange={setRole}>
      {/* Role-specific views are added in the next steps */}
      <p>{getRole(role).label} view coming soon.</p>
    </AppShell>
  )
}

export default App
