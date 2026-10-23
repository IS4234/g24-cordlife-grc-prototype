import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { SimulationBar } from './components/SimulationBar'
import { DEFAULT_ROLE, getRole, type RoleId } from './roles'
import { CgoView } from './views/CgoView'
import { OperatorView } from './views/OperatorView'

function App() {
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE)

  return (
    <AppShell role={role} onRoleChange={setRole}>
      <SimulationBar />
      {role === 'operator' && <OperatorView />}
      {role === 'cgo' && <CgoView />}
      {(role === 'board' || role === 'moh') && <p>{getRole(role).label} view coming soon.</p>}
    </AppShell>
  )
}

export default App
