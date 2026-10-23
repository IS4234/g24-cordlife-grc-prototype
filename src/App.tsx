import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { SimulationBar } from './components/SimulationBar'
import { DEFAULT_PERSON } from './domain/people'
import { DEFAULT_ROLE, getRole, type RoleId } from './roles'
import { CgoView } from './views/CgoView'
import { OperatorView } from './views/OperatorView'

function App() {
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE)
  // Kept here so the chosen person survives switching between role tabs
  const [cgoActor, setCgoActor] = useState(DEFAULT_PERSON.cgo)

  return (
    <AppShell role={role} onRoleChange={setRole}>
      <SimulationBar />
      {role === 'operator' && <OperatorView />}
      {role === 'cgo' && <CgoView actorId={cgoActor} onActorChange={setCgoActor} />}
      {(role === 'board' || role === 'moh') && <p>{getRole(role).label} view coming soon.</p>}
    </AppShell>
  )
}

export default App
