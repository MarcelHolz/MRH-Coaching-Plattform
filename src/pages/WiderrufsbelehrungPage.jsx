import widerrufText from '../content/widerruf.md?raw'
import RechtstextSeite from '../components/RechtstextSeite'

export default function WiderrufsbelehrungPage() {
  return <RechtstextSeite markdown={widerrufText} titel="Widerrufsbelehrung" />
}
