// All user-facing strings live here — see CLAUDE.md §2 rule 6.
export const nb = {
  appName: 'Treningslogg',
  auth: {
    loginTitle: 'Logg inn',
    emailLabel: 'E-post',
    emailPlaceholder: 'du@eksempel.no',
    sendLink: 'Send innloggingslenke',
    linkSent: 'Sjekk e-posten din for innloggingslenke.',
    signOut: 'Logg ut',
  },
  nav: {
    home: 'Oversikt',
    logger: 'Logg økt',
    progress: 'Progresjon',
    runs: 'Løping',
    blocks: 'Blokker',
    settings: 'Innstillinger',
  },
  home: {
    programTitle: 'Program',
    noProgram: 'Ingen aktiv treningsblokk ennå.',
    loading: 'Laster …',
  },
  settings: {
    title: 'Innstillinger',
    buildHash: 'Byggversjon',
  },
} as const
