import agbText from '../content/agb.md?raw'
import RechtstextSeite from '../components/RechtstextSeite'

export default function AgbPage() {
  return <RechtstextSeite markdown={agbText} titel="AGB" />
}
