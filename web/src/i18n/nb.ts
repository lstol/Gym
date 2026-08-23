// All user-facing strings live here — see CLAUDE.md §2 rule 6.
export const nb = {
  appName: 'Treningslogg',
  auth: {
    loginTitle: 'Logg inn',
    emailLabel: 'E-post',
    emailPlaceholder: 'du@eksempel.no',
    passwordLabel: 'Passord',
    signIn: 'Logg inn',
    signOut: 'Logg ut',
    changePasswordTitle: 'Bytt passord',
    changePasswordHint: 'Du må bytte passord før du kan fortsette.',
    newPasswordLabel: 'Nytt passord',
    confirmPasswordLabel: 'Bekreft nytt passord',
    changePasswordSubmit: 'Bytt passord',
    passwordTooShort: 'Passordet må være minst 8 tegn.',
    passwordMismatch: 'Passordene er ikke like.',
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
