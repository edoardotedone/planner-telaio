// model.js — numeri raccolti dal fonico + matematica di fit.
// Nessuna dipendenza, nessun three.js qui. Tutto in millimetri e chilogrammi.
//
// Versione B: il modello parte dalle MISURE (domande A9-A14, B1-B4), non dalle
// quote di catalogo. La cassa disegnata e i suoi margini DERIVANO da quelle
// misure, cosi' un campo del foglio = un campo dell'app = un numero nell'URL.

export const round1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- domande
// k = chiave in state.m (e nome del parametro nell'URL condiviso)
// q = numero della domanda sul foglio A4
// def = valore PROVVISORIO di partenza: finche' un campo e' al suo def, la
//       domanda conta come non risposta (vedi askedMap in app.js).
export const MEASURES = [
  { k: 'recW', q: 'A9', label: 'rettangolo moquette - larghezza', unit: 'mm',
    note: 'da bordo interno a bordo interno della cornice del ripiano' },
  { k: 'recD', q: 'A9', label: 'rettangolo moquette - profondita', unit: 'mm',
    note: 'e l ingombro massimo in profondita del telaio' },
  { k: 'recH', q: 'A13', label: 'piano moquette -> faccia inferiore coperchio', unit: 'mm',
    note: 'altezza utile del telaio: il numero piu importante' },
  { k: 'floor', q: 'A12', label: 'fondo cassa -> piano moquette', unit: 'mm',
    note: 'altezza del pavimento su cui sale il telaio' },
  { k: 'barLong', q: 'A10', label: 'cornice ripiano - lato LUNGO (fronte/retro)', unit: 'mm' },
  { k: 'barShort', q: 'A10', label: 'cornice ripiano - lato CORTO (sinistro/destro)', unit: 'mm' },
  { k: 'lip', q: 'A11', label: 'bordo della cornice sopra il piano', unit: 'mm',
    note: 'e il registro che centra il telaio' },
  { k: 'travel', q: 'A14', label: 'escursione del ripiano tirato fuori', unit: 'mm' },
  { k: 'guideKg', q: 'A14', label: 'portata dichiarata delle guide', unit: 'kg' },
  { k: 'bagW', q: 'B1', label: 'borsa - larghezza', unit: 'mm' },
  { k: 'bagD', q: 'B2', label: 'borsa - profondita', unit: 'mm' },
  { k: 'bagH', q: 'B3', label: 'borsa - altezza', unit: 'mm' },
  { k: 'bagPad', q: 'B4', label: 'borsa - spessore imbottitura', unit: 'mm',
    note: 'sottrai questo dalle misure esterne: e lo spazio che non usi' },
];

// Le due domande aperte del foglio che non sono numeri: Val decide, non misura.
export const DECISIONS = [
  { k: 'overhang', q: 'C1', label: 'il telaio puo sporgere dal registro?',
    yes: 'puo sporgere', no: 'deve restare dentro' },
  { k: 'liftOut', q: 'C2', label: 'il telaio esce intero e va in borsa?',
    yes: 'si, esce intero', no: 'no, resta in cassa' },
];

export const PROFILES = [
  { section: 15, wall: 1.2, kgPerM: 0.55, label: '15x15 slot 5', source: 'mine' },
  { section: 20, wall: 1.5, kgPerM: 0.80, label: '20x20 slot 6', source: 'mine' },
  { section: 30, wall: 2.0, kgPerM: 1.30, label: '3030 slot 8', source: 'mine' },
];

export const PLEXI_OPTIONS = [3, 4, 5, 6, 8];

export const MODULES = [
  { id: 'scorpio', label: 'Scorpio + XL-AES', w: 320, d: 205, h: 70, kg: 1.6,
    source: 'derived', note: 'Scorpio 51 mm + XL-AES 19 mm' },
  { id: 'ad8', label: 'Sonosax SX-AD8+', w: 200, d: 145, h: 50, kg: 1.0, source: 'published' },
  { id: 'psr', label: 'PSC RF Multi SR', w: 337, d: 146, h: 41, kg: 2.0,
    source: 'derived', note: '13.25 x 5.75 x 1.6 in convertito' },
  { id: 'rx1', label: 'Ricevitore RF', w: 190, d: 130, h: 45, kg: 0.9, source: 'placeholder' },
  { id: 'trio', label: 'eSMART TRIO', w: 83, d: 94, h: 40, kg: 0.4,
    source: 'published', note: 'sdraiato: 94 mm in profondita, 40 di altezza' },
  { id: 'li96', label: 'eSMART Li-96neo', w: 80, d: 130, h: 45, kg: 0.8, source: 'placeholder', note: 'girato di 90 gradi: 80 di largo, 130 di profondo' },
];

export const MODULE_COLOR = [0x3a6ea5, 0x2f7d5b, 0x8a5a2b, 0x5b4b8a, 0x2f8f8f, 0x7a3b52, 0x6b6b2f];

const GAP = 8; // gioco laterale tra moduli adiacenti messi in fila automatica
const PLAY_MAX = 12; // mm di gioco totale per lato per cui il registro centra ancora
const E_PLEXI = 3200; // MPa

export const SOURCE_LABEL = {
  published: 'scheda',
  catalogue: 'catalogo',
  derived: 'calcolato',
  placeholder: 'provvisorio',
  mine: 'scelta nostra',
};

// ------------------------------------------------------------- stato vivo
export const state = {
  envelope: 'case',
  profileSection: 15,
  profileWall: 1.2,
  plexi: 5,
  overhang: false, // C1: il telaio puo sporgere dal registro
  liftOut: true,   // C2: il telaio esce intero e va in borsa
  showDims: true,

  // Le misure. Ogni campo e' una domanda del foglio; i valori qui sono
  // PROVVISORI (derivati dal catalogo SKB) e valgono finche' non arrivano A9-A14.
  m: {
    recW: 470, recD: 227, recH: 242, floor: 25,
    barLong: 20, barShort: 6.7, lip: 8, travel: 0, guideKg: 0,
    bagW: 380, bagD: 220, bagH: 200, bagPad: 20,
  },

  // Scelte di progetto nostre, non domande per il fonico.
  clearW: 435,
  clearD: 195,
  shelves: [
    { id: 's1', label: 'L1', clearH: 70 },
    { id: 's2', label: 'L2', clearH: 55 },
    { id: 's3', label: 'L3', clearH: 65 },
  ],
  placements: {
    scorpio: 's1', trio: 's1', ad8: 's2', rx1: 's2', psr: 's3', li96: 's3',
  },
  placeX: {}, // id -> x in mm dal bordo interno sinistro; vuoto = fila automatica
};

// --------------------------------------------------------------- geometria
export function profile(s = state) {
  return PROFILES.find((p) => p.section === s.profileSection) || PROFILES[0];
}

// Lo spazio libero dentro il registro del ripiano: e cio' che si misura (A9, A13).
export function recess(s = state) {
  const { recW, recD, recH, floor, barLong, barShort, lip } = s.m;
  return { w: recW, d: recD, h: recH, floor, bar: barLong, barShort, lip };
}

// Il guscio cassa disegnato: il registro piu lo spazio libero. Non e una misura
// del fonico, e una conseguenza; serve solo a dare il contesto visivo.
export function caseShell(s = state) {
  const r = recess(s);
  return {
    id: 'case', label: 'Cassa SKB + ripiano scorrevole',
    w: Math.round(r.w + 2 * r.barShort), d: Math.round(r.d + 2 * r.bar),
    h: Math.round(r.h + r.floor), source: 'derived',
    note: `guscio derivato dalle misure: registro ${round1(r.barShort)} mm corto / ${r.bar} mm lungo, pavimento a ${r.floor} mm`,
  };
}

export function bagShell(s = state) {
  const p = s.m.bagPad || 0;
  return {
    id: 'bag', label: 'Borsa Samas (misure B1-B4)',
    w: Math.round(s.m.bagW - 2 * p), d: Math.round(s.m.bagD - 2 * p),
    h: Math.round(s.m.bagH - 2 * p), source: s.m.bagPad === 20 ? 'placeholder' : 'published',
    note: p ? `esterne ${s.m.bagW} x ${s.m.bagD} x ${s.m.bagH}, meno ${p} mm di imbottitura per lato` : 'misure interne',
  };
}

// Il telaio e definito dalla LUCE interna; l'ingombro esterno aggiunge le pareti
// di profilo. `clearH` e lo spazio RESIDUO: ogni livello paga anche il proprio
// pannello in plexiglass.
export function carrier(s = state) {
  const p = profile(s).section;
  const t = s.plexi;
  const stack = s.shelves.reduce((sum, sh) => sum + sh.clearH + t, 0);
  const c = {
    w: s.clearW + 2 * p, d: s.clearD + 2 * p, h: 2 * p + stack,
    p, t, clearW: s.clearW, clearD: s.clearD,
  };
  // Catena verticale: base -> pannello -> residuo -> pannello -> ... -> cima.
  let panelY = p;
  const chain = [];
  for (const sh of s.shelves) {
    chain.push({ id: sh.id, panelY, levelY: panelY + t, clearH: sh.clearH });
    panelY = panelY + t + sh.clearH;
  }
  c.chain = chain;
  c.topY = panelY; // da qui in su c e il rettangolo di cima
  return c;
}

export function frameKg(c, s = state) {
  // 4 montanti + 2 rettangoli (base e cima), lunghezza netta dei profili.
  const len = 4 * c.h + 2 * (2 * (c.w - c.p) + 2 * (c.d - c.p));
  return round1((len / 1000) * profile(s).kgPerM);
}

function sagMM(thk, span, width, loadKg) {
  const I = (width * thk ** 3) / 12;
  return ((loadKg * 9.81) * span ** 3) / (48 * E_PLEXI * I);
}

// ------------------------------------------------------- posti sui livelli
function packLevel(s, shelf, c) {
  const mods = MODULES.filter((m) => s.placements[m.id] === shelf.id);
  const placed = mods.map((m) => ({ m, x: s.placeX[m.id] ?? null, moved: s.placeX[m.id] != null }));
  let cursor = 0;
  for (const p of placed) {
    if (p.x === null) { p.x = cursor; cursor += p.m.w + GAP; }
  }
  placed.sort((a, b) => a.x - b.x);

  const bad = new Set();
  const clash = [];
  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1];
    const overlap = prev.x + prev.m.w - placed[i].x;
    if (overlap > 0) {
      clash.push({ a: prev.m, b: placed[i].m, overlap: Math.round(overlap) });
      bad.add(prev.m.id); bad.add(placed[i].m.id);
    }
  }
  const used = placed.length ? Math.max(...placed.map((p) => p.x + p.m.w)) : 0;
  if (used > c.clearW) {
    for (const p of placed) if (p.x + p.m.w > c.clearW) bad.add(p.m.id);
  }
  for (const m of mods) {
    if (m.h > shelf.clearH || m.d > c.clearD) bad.add(m.id);
  }
  const load = mods.reduce((sum, m) => sum + m.kg, 0);
  const sag = sagMM(s.plexi, c.clearW, c.clearD, Math.max(load, 1));
  return { shelf, mods, placed, used, load, sag, bad, clash };
}

// ---------------------------------------------------------------- analisi
// analyse(s) accetta uno snapshot: serve a valutare il confronto A/B senza
// toccare lo stato vivo.
export function analyse(s = state) {
  const c = carrier(s);
  const r = recess(s);
  const shell = caseShell(s);
  const bag = bagShell(s);
  const issues = [];
  const axis = { w: 'larghezza', d: 'profondita', h: 'altezza' };

  const fits = {};
  const targets = [
    { id: 'case', label: 'registro del ripiano', free: r, env: shell, soft: s.overhang },
    { id: 'bag', label: 'borsa Samas', free: bag, env: bag, soft: !(s.liftOut && s.envelope === 'bag') },
  ];
  for (const t of targets) {
    const over = [];
    for (const k of ['w', 'd', 'h']) {
      if (c[k] > t.free[k]) over.push(`${axis[k]} ${c[k]} > ${t.free[k]} mm`);
    }
    fits[t.id] = { ok: over.length === 0 || t.soft, over, free: t.free, soft: t.soft, label: t.label };
    for (const line of over) {
      issues.push({ level: t.soft ? 'warn' : 'fail', where: t.label, text: line });
    }
    if (t.id === 'case' && !s.overhang) {
      for (const k of ['w', 'd']) {
        const play = t.free[k] - c[k];
        if (play >= 0 && play <= PLAY_MAX) {
          issues.push({ level: 'info', where: 'registro', text: `${axis[k]}: ${play} mm di gioco, il telaio resta centrato` });
        } else if (play > PLAY_MAX) {
          issues.push({ level: 'warn', where: 'registro', text: `${axis[k]}: ${play} mm di gioco oltre la cornice, il registro non basta (servono fermi o blocchi)` });
        }
      }
    }
  }
  if (s.overhang) {
    issues.push({ level: 'warn', where: 'C1', text: 'telaio fuori dal registro: la cassa non lo centra piu, servono fermi propri' });
  }

  const rows = s.shelves.map((sh) => packLevel(s, sh, c));
  for (const row of rows) {
    for (const cl of row.clash) {
      issues.push({ level: 'warn', where: row.shelf.label, text: `${cl.a.label} e ${cl.b.label} si sovrappongono di ${cl.overlap} mm` });
    }
    if (row.used > c.clearW) {
      issues.push({ level: 'fail', where: row.shelf.label, text: `occupazione ${row.used} mm > luce ${c.clearW} mm` });
    }
    for (const m of row.mods) {
      if (m.h > row.shelf.clearH) issues.push({ level: 'fail', where: row.shelf.label, text: `${m.label}: alto ${m.h} mm > residuo ${row.shelf.clearH} mm` });
      if (m.d > c.clearD) issues.push({ level: 'fail', where: row.shelf.label, text: `${m.label}: profondo ${m.d} mm > luce ${c.clearD} mm` });
    }
    if (row.sag > 6) {
      issues.push({ level: 'fail', where: row.shelf.label, text: `plexiglass ${s.plexi} mm flette ${row.sag.toFixed(1)} mm su ${c.clearW} mm con ${row.load.toFixed(1)} kg` });
    } else if (row.sag > 3) {
      issues.push({ level: 'warn', where: row.shelf.label, text: `flessione ${row.sag.toFixed(1)} mm (plexi ${s.plexi} mm, ${row.load.toFixed(1)} kg) - ok se il pannello e bordato su 2 lati` });
    }
  }

  const kitKg = round1(rows.reduce((sum, row) => sum + row.load, 0));
  const fKg = frameKg(c, s);
  const totalKg = round1(kitKg + fKg);
  const gKg = s.m.guideKg || 0;
  if (gKg > 0 && totalKg > gKg) {
    issues.push({ level: 'fail', where: 'A14', text: `telaio + kit = ${totalKg} kg oltre la portata delle guide (${gKg} kg)` });
  }

  const loose = MODULES.filter((m) => (s.placements[m.id] || 'none') === 'none');
  if (loose.length) issues.push({ level: 'info', where: 'fuori telaio', text: loose.map((m) => m.label).join(', ') });

  return {
    s, c, rows, issues, loose, fits, shell, bag, r,
    kitKg, frameKg: fKg, totalKg,
    anyFail: issues.some((i) => i.level === 'fail'),
  };
}

// --------------------------------------------------------- snapshot / link
export const SNAPSHOT_KEYS = ['m', 'clearW', 'clearD', 'shelves', 'placements', 'placeX',
  'profileSection', 'profileWall', 'plexi', 'overhang', 'liftOut'];

export function snapshot(s = state) {
  const out = {};
  for (const k of SNAPSHOT_KEYS) out[k] = structuredClone(s[k]);
  return out;
}

export function restore(snap, s = state) {
  for (const k of SNAPSHOT_KEYS) {
    if (snap[k] !== undefined) s[k] = structuredClone(snap[k]);
  }
  // placeX puo riferire a livelli cancellati: i posti orfani tornano in fila.
  const live = new Set(s.shelves.map((sh) => sh.id));
  for (const [id, shelf] of Object.entries(s.placements)) {
    if (shelf !== 'none' && !live.has(shelf)) s.placements[id] = 'none';
  }
  for (const id of Object.keys(s.placeX)) {
    if (s.placements[id] === 'none') delete s.placeX[id];
  }
}

export function encodeState(snap = snapshot()) {
  return 'd=' + encodeURIComponent(JSON.stringify(snap));
}

export function decodeState(search) {
  const p = new URLSearchParams(search);
  const raw = p.get('d');
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && obj.m ? obj : null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------- "cosa ho misurato"
// Blocco di testo da copiare e spedire: numeri + che domanda sono, e cosa manca.
export function reportText(snap, asked, plan) {
  const lines = [];
  lines.push('MISURE DEL TELAIO - dal pianificatore Versa v02');
  lines.push(new Date().toISOString().slice(0, 10));
  lines.push('');
  for (const q of MEASURES) {
    const v = snap.m[q.k];
    const done = asked.has(q.k);
    lines.push(`${q.q.padEnd(4)} ${q.label.padEnd(46)} ${String(v).padStart(6)} ${q.unit}${done ? '' : '   <-- PROVVISORIO, da misurare'}`);
  }
  lines.push('');
  lines.push(`C1 ${DECISIONS[0].label} ${snap.overhang ? DECISIONS[0].yes : DECISIONS[0].no}`);
  lines.push(`C2 ${DECISIONS[1].label} ${snap.liftOut ? DECISIONS[1].yes : DECISIONS[1].no}`);
  lines.push('');
  lines.push('SCELT DI PROGETTO');
  lines.push(`profilato ${(snap.profileSection + 'x' + snap.profileSection).padEnd(8)} plexi ${snap.plexi} mm luce ${snap.clearW} x ${snap.clearD}`);
  lines.push('livelli: ' + snap.shelves.map((sh) => `${sh.label} residuo ${sh.clearH}`).join(' | '));
  lines.push('moduli:');
  for (const m of MODULES) {
    const at = snap.placements[m.id] || 'none';
    const x = snap.placeX[m.id];
    lines.push(`  ${(m.label + ' ').padEnd(24, '.')} ${String(at === 'none' ? 'fuori telaio' : at)} ${m.w} x ${m.d} x ${m.h} mm${x != null ? ` @ x=${x}` : ''}`);
  }
  lines.push('');
  lines.push('INGOMBRO TELAIO ' + plan.c.w + ' x ' + plan.c.d + ' x ' + plan.c.h + ' mm  (' + plan.totalKg + ' kg: telaio ' + plan.frameKg + ' + kit ' + plan.kitKg + ')');
  lines.push('registro libero ' + plan.r.w + ' x ' + plan.r.d + ' x ' + plan.r.h + ' mm  -> ' + (plan.fits.case.ok ? 'STA DENTRO' : 'NON STA'));
  lines.push('borsa libera ' + plan.bag.w + ' x ' + plan.bag.d + ' x ' + plan.bag.h + ' mm  -> ' + (plan.fits.bag.ok ? 'STA DENTRO' : 'NON STA'));
  const missing = MEASURES.filter((q) => !asked.has(q.k));
  lines.push('');
  lines.push(missing.length
    ? `DA MISURARE (${missing.length}): ${[...new Set(missing.map((q) => q.q))].join(', ')}`
    : 'tutte le domande misurate sono compilata');
  return lines.join('\n');
}

export function setPlacement(moduleId, shelfId, s = state) {
  s.placements[moduleId] = shelfId;
  if (shelfId === 'none') delete s.placeX[moduleId];
}
