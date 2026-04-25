export const TERMS_VERSION = '1.0';
export const TERMS_LAST_UPDATED = '2026';
export const TERMS_CONTACT_EMAIL = 'hei@knuteloop.no';

// Konsentpunktene som brukeren må krysse av ved registrering.
// Ordet "id" brukes til å logge hvilke punkter som er akseptert i backend.
export const TERMS_CLAUSES = [
  {
    id: 'read-and-understood',
    label:
      'Jeg har lest og forstått brukervilkårene og personvernerklæringen til Russeknute (knuteloop.no) i sin helhet.',
  },
  {
    id: 'age-and-school',
    label:
      'Jeg er fylt 18 år og er aktiv elev ved St. Olav videregående skole for skoleåret 2026.',
  },
  {
    id: 'gdpr-consent',
    label:
      'Jeg samtykker til at KnuteLoop behandler mine personopplysninger (navn og skolee-post) slik det er beskrevet i punkt 5 i vilkårene.',
  },
  {
    id: 'admin-visibility',
    label:
      'Jeg er informert om og aksepterer at administratorer kan se alt innhold jeg publiserer i tjenesten.',
  },
  {
    id: 'consequences',
    label:
      'Jeg er kjent med at brudd på vilkårene kan medføre utestengelse og, i alvorlige tilfeller, varsling til skolens ledelse eller politiet.',
  },
];

// Fullstendige vilkår delt opp i seksjoner for visning i appen.
export const TERMS_SECTIONS = [
  {
    heading: 'Om tjenesten',
    body: [
      'Russeknute er en lukket nettbasert tjeneste utviklet og driftet av KnuteLoop under domenet knuteloop.no. Formålet er å organisere og fasilitere russeknuten for elever ved St. Olav videregående skole skoleåret 2026.',
      'Tjenesten er ikke-kommersiell, ikke offentlig tilgjengelig og er utelukkende beregnet for elever som er en del av russens kull ved St. Olav videregående skole. KnuteLoop er et hobbydrevet prosjekt uten organisasjonsnummer eller kommersiell virksomhet.',
      'Tjenesten gir brukerne mulighet til å delta i en felles feed der russeknuter kan sendes inn og vises for gruppen, skrive kommentarer under innlegg, og kommunisere med andre registrerte brukere innenfor den lukkede gruppen.',
    ],
  },
  {
    heading: 'Hvem kan bruke tjenesten',
    body: [
      'Du må være minimum 18 år, aktiv elev ved St. Olav videregående skole, og du må registrere deg med din offisielle skolee-post på domenet @elev.rogfk.no. Private e-postadresser aksepteres ikke.',
      'Du må eksplisitt godta disse vilkårene ved registrering.',
    ],
  },
  {
    heading: 'Brukerens forpliktelser',
    body: [
      'Det er strengt forbudt å publisere innhold som er mobbende, trakasserende, truende, rasistisk, diskriminerende, seksuelt eksplisitt, ulovlig, krenker andres personvern eller opphavsrett, eller på annen måte er i strid med norsk lov.',
      'Mobbing og trakassering tolereres ikke. Innhold som kan oppleves som mobbing eller krenkelse av andre elever vil bli fjernet umiddelbart. Gjentatte eller alvorlige brudd vil medføre permanent utestengelse og kan bli varslet til skolens ledelse eller politiet.',
      'Du er selv juridisk ansvarlig for alt innhold du publiserer. Hold passordet ditt konfidensielt og varsle hei@knuteloop.no ved mistanke om uautorisert tilgang.',
    ],
  },
  {
    heading: 'Administratortilgang og moderering',
    body: [
      'Tjenesten administreres av to hovedadministratorer og et begrenset antall hjelpeadministratorer. Alle administratorer er aktive elever ved St. Olav videregående skole.',
      'Administratorer kan se alt innhold publisert i tjenesten, se hvilken brukerkonto som har publisert hvert innlegg eller kommentar, redigere eller slette innhold som bryter vilkårene, sperre brukere, og se grunnleggende kontoopplysninger (navn og skolee-post).',
      'Administratorer er underlagt taushetsplikt. Klage på en administratoravgjørelse sendes til hei@knuteloop.no.',
    ],
  },
  {
    heading: 'Personvern og databehandling (GDPR)',
    body: [
      'Vi samler kun inn navn (fornavn og etternavn fra skolekontoen), skolee-postadresse, innholdet du selv publiserer, tidspunkt for publisering, og tekniske opplysninger nødvendige for drift.',
      'Vi samler ikke inn lokasjon, telefonnummer eller andre opplysninger ut over det som er nødvendig.',
      'Behandlingen er basert på ditt samtykke (GDPR art. 6 nr. 1 a). Samtykket kan trekkes tilbake når som helst ved å kontakte hei@knuteloop.no, noe som vil medføre sletting av kontoen din.',
      'All data lagres på servere i Helsinki, Finland (EU/EØS).',
      'Dine rettigheter etter GDPR: innsyn, retting, sletting, begrensning, dataportabilitet og innsigelse. Send henvendelse til hei@knuteloop.no — vi besvarer innen 30 dager. Du kan også klage til Datatilsynet (datatilsynet.no).',
      'All persondata og brukergenerert innhold slettes senest 90 dager etter at russetiden for inneværende kull er avsluttet, med mindre norsk lov krever lengre oppbevaring.',
    ],
  },
  {
    heading: 'Innhold og opphavsrett',
    body: [
      'Du beholder opphavsretten til innhold du selv publiserer. Ved å publisere gir du KnuteLoop en begrenset, vederlagsfri rett til å lagre, vise og distribuere innholdet til øvrige brukere.',
      'Alt design, kode og funksjonalitet utviklet av KnuteLoop er KnuteLoops eiendom og kan ikke kopieres uten skriftlig samtykke.',
    ],
  },
  {
    heading: 'Utestengelse og opphør',
    body: [
      'Brukere som bryter vilkårene kan bli midlertidig eller permanent utestengt. Førstegangs eller mindre alvorlige brudd vil normalt få en skriftlig advarsel. Alvorlige brudd kan medføre umiddelbar sperring uten varsel.',
      'KnuteLoop forbeholder seg retten til å varsle skolens ledelse eller politiet ved mistanke om straffbare forhold.',
      'Du kan når som helst be om sletting av kontoen din via innstillinger eller ved å sende e-post til hei@knuteloop.no. Sletteforespørsler behandles innen 7 virkedager.',
    ],
  },
  {
    heading: 'Ansvarsbegrensning',
    body: [
      'Tjenesten tilbys "slik den er". KnuteLoop er et hobbydrevet prosjekt og gir ingen garantier for tilgjengelighet, feilfrihet eller drift uten avbrudd.',
      'KnuteLoop er ikke ansvarlig for innhold publisert av brukere, og ikke erstatningsansvarlig for indirekte tap, tap av data eller andre følgetap, i den utstrekning dette er tillatt etter norsk lov.',
    ],
  },
  {
    heading: 'Endringer og kontakt',
    body: [
      'Vi kan endre vilkårene. Ved vesentlige endringer varsles registrerte brukere via skolee-posten med minst 7 dagers frist. Fortsatt bruk etter endringer trer i kraft anses som aksept av nye vilkår.',
      'Norsk rett gjelder. Tvister søkes løst i minnelighet, ellers ved norske alminnelige domstoler i rettskretsen til St. Olav videregående skole.',
      'Kontakt: hei@knuteloop.no — Russeknute · knuteloop.no — St. Olav videregående skole, Stavanger.',
    ],
  },
];
