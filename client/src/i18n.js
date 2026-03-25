const translations = {
  fr: {
    // Onboarding
    welcome: 'Bienvenue sur score26',
    choosePseudo: 'Choisis ton pseudo',
    pseudoPlaceholder: 'Ton pseudo...',
    validate: 'Valider',
    pseudoTaken: 'Ce pseudo est déjà pris, essaies-en un autre.',
    pseudoEmpty: 'Le pseudo ne peut pas être vide.',

    // Navigation
    upcoming: 'À venir',
    past: 'Passés',
    profile: 'Profil',

    // Matchs
    noProno: 'Aucun prono',
    locked: 'Verrouillé',
    scoreObtenu: 'score obtenu',

    // Profil
    totalScore: 'Score total',
    summary: 'Résumé',
    exactScores: 'scores exacts',
    goodOutcomes: 'bonnes issues',
    missed: 'ratés',
    share: 'Partager',
  },
  en: {
    // Onboarding
    welcome: 'Welcome to score26',
    choosePseudo: 'Choose your username',
    pseudoPlaceholder: 'Your username...',
    validate: 'Confirm',
    pseudoTaken: 'This username is taken, try another one.',
    pseudoEmpty: 'Username cannot be empty.',

    // Navigation
    upcoming: 'Upcoming',
    past: 'Past',
    profile: 'Profile',

    // Matchs
    noProno: 'No prediction',
    locked: 'Locked',
    scoreObtenu: 'score obtained',

    // Profil
    totalScore: 'Total score',
    summary: 'Summary',
    exactScores: 'exact scores',
    goodOutcomes: 'good outcomes',
    missed: 'missed',
    share: 'Share',
  },
}

export function t(lang, key) {
  return translations[lang]?.[key] ?? key
}
