import { DeviationRegister } from '../components/DeviationRegister'
import { DEFAULT_PERSON } from '../domain/people'

export function CgoView() {
  return <DeviationRegister role="cgo" actorId={DEFAULT_PERSON.cgo} canRaise />
}
