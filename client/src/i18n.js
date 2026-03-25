const translations = {
  fr: {
    welcome: 'Bienvenue sur score26',
    choosePseudo: 'Choisis ton pseudo',
    pseudoPlaceholder: 'Ton pseudo...',
    validate: 'Valider',
    pseudoTaken: 'Ce pseudo est déjà pris, essaies-en un autre.',
    pseudoEmpty: 'Le pseudo ne peut pas être vide.',
    upcoming: 'À venir',
    past: 'Passés',
    profile: 'Profil',
    noProno: 'Aucun prono',
    locked: 'Verrouillé',
    totalScore: 'Score total',
    summary: 'Résumé',
    exactScores: 'scores exacts',
    goodOutcomes: 'bonnes issues',
    missed: 'ratés',
    share: 'Partager',
  },
  en: {
    welcome: 'Welcome to score26',
    choosePseudo: 'Choose your username',
    pseudoPlaceholder: 'Your username...',
    validate: 'Confirm',
    pseudoTaken: 'This username is taken, try another one.',
    pseudoEmpty: 'Username cannot be empty.',
    upcoming: 'Upcoming',
    past: 'Past',
    profile: 'Profile',
    noProno: 'No prediction',
    locked: 'Locked',
    totalScore: 'Total score',
    summary: 'Summary',
    exactScores: 'exact scores',
    goodOutcomes: 'good outcomes',
    missed: 'missed',
    share: 'Share',
  },
}

// Dictionnaire de traduction des noms d'équipe FR → EN
// Le nom en base est toujours en français (convention du projet)
const teamNamesEN = {
  'France':     'France',
  'Brésil':     'Brazil',
  'Allemagne':  'Germany',
  'Argentine':  'Argentina',
  'Portugal':   'Portugal',
  'Espagne':    'Spain',
  'Italie':     'Italy',
  'Angleterre': 'England',
  'Pays-Bas':   'Netherlands',
  'Belgique':   'Belgium',
  'Croatie':    'Croatia',
  'Maroc':      'Morocco',
  'Sénégal':    'Senegal',
  'Japon':      'Japan',
  'Corée du Sud': 'South Korea',
  'Mexique':    'Mexico',
  'États-Unis': 'USA',
  'Canada':     'Canada',
  'Australie':  'Australia',
  'Suisse':     'Switzerland',
  'Danemark':   'Denmark',
  'Pologne':    'Poland',
  'Tunisie':    'Tunisia',
  'Ghana':      'Ghana',
  'Équateur':   'Ecuador',
  'Uruguay':    'Uruguay',
  'Colombie':   'Colombia',
  'Chili':      'Chile',
  'Arabie Saoudite': 'Saudi Arabia',
  'Cameroun':   'Cameroon',
  'Iran':       'Iran',
  'Qatar':      'Qatar',
}

// Traduit "🇫🇷 France" → "🇫🇷 France" (FR) ou "🇫🇷 France" (EN)
// Le format en base est toujours : "<emoji> <nom en français>"
export function translateTeam(name, lang) {
  if (!name) return ''
  if (lang === 'fr') return name
  const spaceIdx = name.indexOf(' ')
  if (spaceIdx === -1) return name
  const emoji = name.slice(0, spaceIdx)
  const nameFr = name.slice(spaceIdx + 1)
  return `${emoji} ${teamNamesEN[nameFr] ?? nameFr}`
}

// Sépare l'emoji du nom (ex: "🇫🇷 France" → { flag: "🇫🇷", name: "France" })
export function splitTeam(fullName, lang) {
  const translated = translateTeam(fullName, lang)
  const spaceIdx = translated.indexOf(' ')
  return {
    flag: translated.slice(0, spaceIdx),
    name: translated.slice(spaceIdx + 1),
  }
}

export function t(lang, key) {
  return translations[lang]?.[key] ?? key
}
