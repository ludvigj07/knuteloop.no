const RUSS_NAMES = [
  'Sokkelos',
  'Pjuskeprinsen',
  'Tøffel-Tobias',
  'Sluskebjørn',
  'Borrelås',
  'Snublende Snorre',
  'Stivnete Stein',
  'Vatret Vebjørn',
  'Trampoline-Trine',
  'Pinnsvin-Petter',
  'Fjørkålet',
  'Knirkete Knut',
  'Pelsete Petter',
  'Stødige Sigurd',
  'Lavmælte Lars',
  'Bjeffende Bertil',
  'Hånlatter',
  'Pulver-Per',
  'Bagettbaker',
  'Skranglekjerre',
  'Slumrende Stine',
  'Kaffetraktor',
  'Brettspill-Brian',
  'Klatrelus',
  'Pølsekonge',
  'Vridd Vidar',
  'Sløvinger',
  'Tinglyst Tobias',
  'Krøllete Karsten',
  'Slurpete Sven',
  'Pjokk-Peder',
  'Furtende Frida',
  'Snorking Stine',
  'Vaskeren',
  'Loftsfeier',
  'Slurvete Sigrid',
  'Hipp-Hopp Henning',
  'Brusbjørn',
  'Klatremus',
  'Knipseren',
  'Kjegleknekker',
  'Mygge-Maja',
  'Tøysebukk',
  'Snurrende Sigurd',
  'Filterkaffe',
  'Strikkende Stine',
  'Brettkjeks',
  'Pesende Per',
  'Plumpe-Pia',
  'Lommetyv',
  'Sukkerpøse',
  'Dingsen',
  'Smultring-Steffen',
  'Slurveren',
  'Forsoffen Frans',
  'Buljongbamse',
  'Bagateller',
  'Furre-Frida',
  'Slumrekrok',
  'Multeren',
  'Stikkebille',
  'Knottklemmer',
  'Posepølse',
  'Tankeløs',
  'Lompe-Lars',
  'Skummetmelk',
  'Tørrtraver',
  'Pølse-Pia',
  'Hodeputen',
  'Snufsen',
  'Drømmegris',
  'Pinne-Petter',
  'Stikkende Steffen',
  'Lurvegjengen',
  'Snurrebass',
];

export function createRussNamePool() {
  const shuffled = [...RUSS_NAMES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    pool: shuffled,
    used: new Set(),
    take(existingNames = []) {
      const taken = new Set([...this.used, ...existingNames]);
      for (const name of this.pool) {
        if (!taken.has(name)) {
          this.used.add(name);
          return name;
        }
      }
      let counter = 2;
      while (true) {
        for (const name of this.pool) {
          const candidate = `${name} ${counter}`;
          if (!taken.has(candidate)) {
            this.used.add(candidate);
            return candidate;
          }
        }
        counter += 1;
      }
    },
  };
}
