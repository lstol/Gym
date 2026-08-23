# Arkitektur — Treningslogg, gym.syndikatet.eu

Revisjon 2. Endringer fra rev 1: offline-først fjernet, lastmodellen skrevet om rundt
maskinens stasjoner og pulley-ratioer, faseplan justert.

Beslutningsdokument. Hver beslutning står med alternativet den ble valgt foran, og hva den
koster. Der jeg er usikker, står det.

---

## 1. Problemet, presist formulert

Ikke «en treningsapp». Tre konkrete behov:

1. **Registrering mellom sett.** Telefon, 60–90 sekunder, ikke lyst til å fikle. Hvert
   ekstra tastetrykk er en reell kostnad.
2. **Progresjonsspørsmålet.** Går det fremover, og hva skal på neste gang? Dette er det
   papirloggen faktisk er dårlig på — du ser tallene, men ikke mønsteret.
3. **Blokkevaluering.** De første fem ukene er en evaluering av oppsettet. Appens egentlige
   produkt er ikke loggen, det er grunnlaget for å planlegge neste blokk.

Enbrukerapp med to års levetid, ikke et produkt. Den vanligste feilen i slike prosjekter er å
bygge for en skala som aldri kommer.

---

## 2. Systemoversikt

```
┌──────────────────────────────────────────────┐
│  PWA (React + TS)   gym.syndikatet.eu        │
│  ┌────────────┐  ┌─────────────┐             │
│  │ UI/features│→ │ domain/     │  ren logikk │
│  └─────┬──────┘  └─────────────┘             │
│        │ TanStack Query                       │
│        │ localStorage: én økt-kladd           │
└────────┼──────────────────────────────────────┘
         │ HTTPS, anon key + JWT
┌────────▼──────────────────────────────────────┐
│  Supabase                                     │
│   Postgres  ── RLS på user_id                 │
│   Auth      ── e-post + passord               │
│   Edge Functions: strava-oauth, strava-sync   │
│   pg_cron   ── sync hver 6. time              │
└────────┬──────────────────────────────────────┘
         │  client_secret ligger KUN her
┌────────▼────────┐
│   Strava API    │
└─────────────────┘

Netlify: statisk CDN + domenepeking. Ingen kjøretid, ingen hemmeligheter.
```

---

## 3. Beslutninger

### 3.1 Offline er fjernet

Rev 1 hadde offline-først med Dexie, outbox og idempotent synk. Det er ute.

**Hva som blir igjen:** direkte kall mot Supabase via TanStack Query, pluss én
`localStorage`-kladd av økten som pågår, så en låst telefon eller en refresh ikke koster deg
sesjonen. Tretti linjer kode i stedet for tre dagers arbeid og en hel feilklasse som bare
oppstår i grensetilfeller.

**Hva det koster:** faller nettet mens du står midt i en økt, får du ikke lagret før det er
tilbake. Kladden gjør at ingenting går tapt — du trykker lagre på nytt senere.

PWA-oppsettet beholdes for installerbarhet og hjemskjerm-ikon. Det er en app-shell-cache, ikke
en datacache.

### 3.2 Lastmodellen: pinne inn, kilo ut

Dette er den viktigste beslutningen i dokumentet, og den er ny i rev 2.

M2 har én vektstack som mater flere stasjoner gjennom ulike utvekslinger. Produsentens spec,
gjengitt av forhandlere: mid- og lavpulley 2:1, lat/øvre pulley 1:1, leg extension 1:1, seated
leg curl 4:3, press arm 2:1.2.

Stacken er bekreftet: toppkloss 15 lb (6,804 kg) pluss 15 plater à 10 lb (4,536 kg), til
sammen 74,84 kg. Det treffer produsentens 165 lb eksakt, som er en god indikasjon på at
modellen er riktig. Stackvekt ved pinne *n* er `6,804 + 4,536n` kg.

Effektivt steg per pinne blir da 4,54 kg på høypulley, 2,27 kg på mid/lav og 2,72 kg på
pressarmen. Den relativt tunge toppklossen løfter bunnen av skalaen og demper prosentspranget
på lave pinner — 29 % i stedet for 50 % på pinne 2.

Like viktig er **taket per stasjon**: lavpulleyen stopper på 37,4 kg effektivt, pressarmen på
44,9 kg, høypulleyen på 74,8 kg. For en bilateral hoftehengsel er 37 kg innen rekkevidde i
løpet av en blokk eller to. Modellen må derfor kjenne `max_effective_kg` per stasjon og si fra
ved 90 %, fordi svaret da er en annen øvelse, ikke en plate til.

**Problemet med disse tallene — oppdatert august 2026.** Notasjonen leses nå som
*stack:motstand*, altså faktor = høyre ÷ venstre. Under den konvensjonen er produsentens
M2-liste entydig: mid/lav 2:1 = 0,5 · lat/øvre 1:1 = 1,0 · leg ext 1:1 = 1,0 ·
seated leg curl 4:3 = 0,75 · beinpress 1:2 = 2,0 · pressarm 2:1.2 = 0,6.

Inspires egen øvelsesplakat bekrefter fem av disse. Den ene som spriker er **pressarmen**:
plakaten skriver «Weight Ratio 1 to 1.2» = **1,2**, altså dobbelt av M2-listens 0,6. Vi følger
M2-listen (0,6), men dette er den ene verdien som må måles før den kan stoles på. Ingen av
kildene er et måleresultat.

**Derfor:** `set_entry` lagrer *pinnenummer og stasjon*. Effektiv vekt beregnes i en view.
Faktoren per stasjon ligger som maskinkonfigurasjon med en `calibration_status`.

Gevinsten er konkret: heng en badevekt eller en fjærvekt i kabelen, mål hva pinne 10 faktisk
gir på hver stasjon, sett `calibration_status = 'measured'` — og hele historikken regnes om
riktig. Hadde du lagret kilo, ville en feil faktor korrumpert loggen permanent.

**Kostnad:** en ekstra join i alle spørringer, og en `machine`/`station`-modell som ser
overdimensjonert ut for én maskin. Den er den ikke — den er billig forsikring mot det eneste
datatapet som ikke kan repareres.

### 3.3 Progresjonsmotoren predikerer repetisjonsfallet

Rev 1 hadde en «ikke foreslå sprang over 10 %»-regel. Den er erstattet, fordi den ikke svarte
på det brukeren faktisk trenger å vite.

Når du går opp én plate, koster det repetisjoner, og hvor mange avhenger helt av stasjonen og
av hvor du sitter på stacken. Motoren regner
`predictedReps = currentReps − (steg i prosent) / 2,5`.

Mikroplater er utelukket som virkemiddel. Dermed kan motoren **ikke** blokkere et pinnehopp
som sender deg under `rep_min` — da ville du aldri progresjonert på høypulleyen i det hele
tatt. Rollen er derfor prognose og rådgivning, ikke portvakt:

- Forslaget går alltid gjennom når betingelsen for dobbel progresjon er oppfylt.
- Predikerte reps vises alltid, så det ikke kommer som en overraskelse at 14 blir 6.
- Havner prognosen under `rep_min`, gir appen et **intervallråd**: denne øvelsens
  repetisjonsintervall er for smalt for sin posisjon på stacken, og bør utvides. Rådet vises,
  men malen skrives aldri om automatisk.

Eksempler:
- Sittende roing, lavpulley, pinne 12 (30,6 kg): +2,27 kg er 7,4 % → 12 blir omtrent 9.
  Innenfor 8–12, ingen råd.
- Nedtrekk, høypulley, pinne 6 (34,0 kg): +4,54 kg er 13,3 % → 12 blir omtrent 7. Forslaget
  går gjennom, rådet er å utvide til 8–13.
- Triceps pushdown, høypulley, pinne 2 (15,9 kg): +4,54 kg er 28,6 % → 14 blir omtrent 3.
  Rådet er cirka 6–16. Dette er verstefallet i programmet, og motoren må håndtere det uten å
  klemme tallene til noe meningsløst.

Intervallrådene revurderes ved blokkevaluering, ikke midt i en blokk. Etter hvert som pinnen
klatrer, faller prosentspranget, og intervallene kan snevres inn igjen — det skal appen også
si fra om.

**Usikkerhet, sagt tydelig:** 2,5 % per repetisjon er en grov approksimasjon fra RM-tabeller.
Den varierer mellom øvelser, mellom personer, og treffer dårligere over 12 reps. Den er en
kalibreringsparameter, ikke en naturlov, og `suggestion_feedback` finnes nettopp for å kunne
etterprøve den etter to blokker.

### 3.4 Supabase som backend

**Valgt fremfor:** Netlify Functions + Turso · egen VPS · rent lokal app uten backend.

Postgres, auth, radnivåsikkerhet og et sted å kjøre serverkode i én tjeneste, uten drift.
Alternativet «ingen backend» falt på at Strava-integrasjonen krever at `client_secret` ligger
utenfor nettleseren — når du først har en server, er det billigere å la den holde dataene òg.

**Kostnad:** Postgres er portabelt; auth, RLS-policyer og Edge Functions er det ikke.
Migrering vekk er et par dagers arbeid, ikke et par timer. Gratistieren pauser prosjekter etter
en uke uten aktivitet — verdt å vite før ferien.

### 3.5 Strava: polling, ikke webhook

`pg_cron` trigger `strava-sync` hver 6. time; funksjonen henter aktiviteter etter siste
synkroniserte tidspunkt, filtrerer på `type = 'Run'` og upserter på `strava_activity_id`.
En «Synk nå»-knapp gjør det samme manuelt.

Webhook krever offentlig endepunkt med verifikasjonshåndtrykk og håndtering av leveranser ute
av rekkefølge, for å gi sanntid på tre løpeturer i uken. Ikke verdt det. Kan legges på senere
uten skjemaendring hvis `strava-sync` bygges slik at den kan kalles med én aktivitets-id.

**Detalj som er lett å ødelegge:** upserten skal bare røre Strava-eide kolonner.
`perceived_effort` og `heavy_legs` er dine egne og må overleve en re-synk.

### 3.6 Ren domenekjerne

`src/domain/` er rene funksjoner: inn plain data, ut plain data.

En progresjonsbug er *taus*. Den produserer plausible tall som er systematisk feil, og du
oppdager det først etter å ha trent etter dem i seks uker. Eneste forsvar er enhetstester på
hele regelsettet — og det får du bare hvis logikken kan kjøres uten database.

### 3.7 Blokker er førsteklasses, fordi evaluering er formålet

Fem uker, evaluer, planlegg neste. Det betyr at `program` er en versjonert blokk med status,
at økter tilhører en blokk, og at det finnes en eksplisitt blokkevaluering som kombinerer
autogenererte tall med fritekstsvar.

Konsekvens for datamodellen fra dag én: aldri en «gjeldende plan» som globale innstillinger.
Alt som beskriver hva du *skulle* gjøre henger på en blokk, slik at blokk 3 kan sammenlignes
med blokk 1 uten at historikken er overskrevet.

---

## 4. Sikkerhet

| Hemmelighet | Hvor | Aldri |
|---|---|---|
| Supabase anon key | klientbundle (`VITE_`) | — offentlig by design, beskyttet av RLS |
| Supabase service role | Edge Function env | i klienten, i git, i en `VITE_`-variabel |
| `STRAVA_CLIENT_SECRET` | Edge Function env | i klienten |
| Strava refresh token | `integration_token` | eksponert via RLS — tabellen har *ingen* klientpolicy |

RLS på alle brukertabeller fra første migrasjon: `user_id = auth.uid()`. `exercise`, `machine`
og `station` er offentlig lesbare, ingenting annet. Auth er e-post + passord —
byttet fra magic link etter at Supabase sin innebygde e-posttjeneste viste seg
å ha en lav, udokumentert rate-grense, ikke ment for produksjon. Passordet
settes direkte i databasen ved førstegangsoppsett (ikke via klienten), med
tvungent passordbytte ved første innlogging.

`VITE_`-prefikset betyr *offentlig*. Den vanligste sikkerhetsfeilen i Supabase-prosjekter er at
service role-nøkkelen ender der, og da er RLS irrelevant.

---

## 5. Deploy

- Netlify bygger `web/` og serverer `web/dist`. `gym.syndikatet.eu` som CNAME.
  Build `pnpm build`, publish `web/dist`, SPA-redirect `/* → /index.html 200`.
- Migrasjoner deployes separat med `supabase db push`. Append-only.
- Edge Functions: `supabase functions deploy <navn>`.

---

## 6. Faseplan

Rekkefølgen er valgt slik at hver fase gir noe brukbart. Blokk 1 kjører på papir uansett —
appen rekker ikke å være klar — så manuell etterregistrering må inn tidlig.

| Fase | Innhold | Ferdig når |
|---|---|---|
| **0** | Repo, Vite+TS+Tailwind, Supabase lokalt, CI, Netlify-deploy av tom app | tom app ligger på domenet |
| **1** | Migrasjoner, RLS, maskin/stasjon-modell, seed med øvelseskatalog og blokk 1, e-post+passord-innlogging | du kan logge inn og se programmet |
| **2** | Logger-UI med pinnevalg, økt-kladd, **manuell etterregistrering med dato** | papirloggen fra blokk 1 kan tastes inn |
| **3** | Domenemotor: effektiv vekt, dobbel progresjon, repetisjonsprediksjon, stalling. Full testdekning. Forslag i loggeren. | forslaget er riktig på alle tre stasjonstyper |
| **4** | Strava OAuth + sync + `perceived_effort`/`heavy_legs` | løpeturer dukker opp av seg selv |
| **5** | Progresjonsvisning: topp-sett per øvelse, ukesammendrag, vektsnitt | «går det fremover» kan besvares uten å telle |
| **6** | Blokkevaluering, kalibreringsverktøy for stasjonsfaktorer, CSV-eksport | blokk 2 kan planlegges fra appen |

Fase 3 er den som må gjøres riktig. Fase 5 er den morsomste og den det er størst fare for å
begynne på for tidlig.

---

## 7. Risikoer, ærlig vurdert

1. **Stasjonstaket på lavpulleyen.** 37,4 kg effektivt er lite for en bilateral hoftehengsel
   for en mann på 109 kg. Det treffes trolig i blokk 2. Fiksen er enbeint utførelse, som
   dessuten er mer løpsspesifikk — men det er en programendring, ikke en appendring, og bør
   planlegges før den blir akutt.
2. **Stasjonsfaktorene er avskrift, ikke måling.** Platevektene er nå bekreftet og
   stemmer mot produsentens totalvekt, men utvekslingene er fortsatt hentet fra datablad
   med inkonsistent notasjon. Tallene på skjermen er anslag til de er kalibrert. Merk dem
   som det.
3. **Brede repetisjonsintervaller har en kostnad.** På triceps og biceps er 6–16 uproblematisk.
   På nedtrekk betyr det flere uker i 12–13-området der stimulus per sett er lavere.
   Alternativet der er å legge til et sett i stedet for reps. Verdt å teste hvis nedtrekk
   stagnerer.
3. **RIR er støyete inndata.** Hele progresjonsregelen hviler på at `rir >= 1` betyr noe
   konsistent. Forvent at motoren er for aggressiv de første ukene.
4. **Appen kan bli mer interessant enn treningen.** Vanligste utfall av et slikt prosjekt er
   en velbygget app og færre gjennomførte økter. Papirloggen virker fra dag én — behold den
   til fase 3 er i bruk.
5. **Fem uker er for lite til å tolke trender.** Grafene blir meningsfulle etter tolv til
   seksten uker. Blokkevalueringen etter blokk 1 handler om gjennomførbarhet og oppsett, ikke
   om resultater.
