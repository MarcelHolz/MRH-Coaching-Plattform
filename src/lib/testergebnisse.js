export const TEST_TYP_LABEL = {
  kurztest_24: 'Vier-Typen-Kurztest',
  vorbereitung_12: 'Coaching-Vorbereitungstest',
}

export const TRAIT_LABEL = {
  dominant: 'Dominant',
  kreativ: 'Kreativ',
  sachlich: 'Sachlich',
  harmonisch: 'Harmonisch',
}

export const TRAIT_ORDER = ['dominant', 'kreativ', 'sachlich', 'harmonisch']

// Entspricht der Typ-Farb-Zuordnung der ursprünglichen Kurztest-App
// (mrh-quiz.vercel.app, DISG-Konvention: Dominant=Rot, Kreativ=Gelb,
// Sachlich=Blau, Harmonisch=Grün). Werte aus der dataviz-Skill-Palette
// gewählt und als 4er-Set gegen CVD-Sicherheit/Kontrast validiert.
export const TRAIT_COLOR = {
  dominant: '#e34948',
  kreativ: '#eda100',
  sachlich: '#2a78d6',
  harmonisch: '#008300',
}
