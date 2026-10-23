import { ActingAs } from '../components/ActingAs'
import { DeviationRegister } from '../components/DeviationRegister'

interface CgoViewProps {
  actorId: string
  onActorChange: (personId: string) => void
}

export function CgoView({ actorId, onActorChange }: CgoViewProps) {
  return (
    <>
      <ActingAs role="cgo" personId={actorId} onChange={onActorChange} />
      <DeviationRegister role="cgo" actorId={actorId} canRaise />
    </>
  )
}
