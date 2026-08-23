// All user-facing strings live here — see CLAUDE.md §2 rule 6.
export const nb = {
  appName: 'Treningslogg',
  auth: {
    loginTitle: 'Logg inn',
    emailLabel: 'E-post',
    emailPlaceholder: 'du@eksempel.no',
    sendLink: 'Send innloggingslenke',
    linkSent: 'Sjekk e-posten din. Klikk lenken, eller skriv inn 6-sifret kode under.',
    codeLabel: 'Engangskode',
    codePlaceholder: '123456',
    verifyCode: 'Logg inn med kode',
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
