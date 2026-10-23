import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { SimulationBar } from './components/SimulationBar'
import { DEFAULT_ROLE, getRole, type RoleId } from './roles'
import { OperatorView } from './views/OperatorView'

function App() {
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE)

  return (
    <AppShell role={role} onRoleChange={setRole}>
      <SimulationBar />
      {role === 'operator' ? <OperatorView /> : <p>{getRole(role).label} view coming soon.</p>}
    </AppShell>
  )
}

export default App
