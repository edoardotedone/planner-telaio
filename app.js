// app.js — interfaccia versione B. Il pannello delle misure E il foglio A4:
// stessi numeri (A9...B4) e stesso nome, e le risposte tornano indietro come
// testo o link. I moduli si trascinano nella scena.

import {
  DECISIONS, MEASURES, MODULES, MODULE_COLOR, PROFILES, PLEXI_OPTIONS, SOURCE_LABEL,
  analyse, decodeState, encodeState, reportText, restore, round1, setPlacement, snapshot, state,
} from './model.js';
import { View } from './scene.js';

const $ = (id) => document.getElementById(id);
const view = new View($('scene'));

const COLORS = {};
MODULES.forEach((m, i) => { COLORS[m.id] = MODULE_COLOR[i % MODULE_COLOR.length]; });

// Valore di partenza di ogni misura: finche un campo e ancora al suo valore di
// partenza la domanda conta come non risposta (i nostri placeholder non sono
// misure del fonico).
const PH = {};
for (const q of MEASURES) PH[q.k] = state.m[q.k];

const askedSet = () => new Set(MEASURES.filter((q) => state.m[q.k] !== PH[q.k]).map((q) => q.k));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
const tagOf = (source) => el('span', 'tag', SOURCE_LABEL[source] || source);

let selected = null;

// ------------------------------------------------------------------ header
function buildTabs() {
  const box = $('envTabs');
  box.textContent = '';
  const names = { case: 'cassa + ripiano', bag: 'borsa Samas' };
  for (const id of ['case', 'bag']) {
    const b = el('button', id === state.envelope ? 'on' : '', names[id]);
    b.onclick = () => { state.envelope = id; buildTabs(); refresh(); };
    box.appendChild(b);
  }
}

// -------------------------------------------------- pannello misure (= foglio)
const askRow = {};
function buildAsk() {
  const box = $('askList');
  box.textContent = '';
  let group = '';
  for (const q of MEASURES) {
    const letter = q.q[0];
    if (letter !== group) {
      group = letter;
      box.appendChild(el('p', 'grp', letter === 'A' ? 'A — cassa e ripiano scorrevole' : 'B — borsa nuova'));
    }
    const row = el('div', 'arow');
    row.appendChild(el('span', 'q', q.q));
    const what = el('span', 'what');
    what.textContent = q.label;
    what.title = q.note || '';
    row.appendChild(what);
    const cell = el('span', '');
    const inp = el('input');
    inp.type = 'number';
    inp.step = '1';
    inp.value = String(state.m[q.k]);
    inp.oninput = () => { state.m[q.k] = Number(inp.value) || 0; refresh(); };
    cell.appendChild(inp);
    cell.appendChild(el('span', 'unit', ' ' + q.unit));
    row.appendChild(cell);
    row.appendChild(el('span', 'dot'));
    box.appendChild(row);
    askRow[q.k] = row;
  }
}

function buildDec() {
  const box = $('decList');
  box.textContent = '';
  for (const d of DECISIONS) {
    const b = el('button', state[d.k] ? 'on' : '');
    b.appendChild(el('span', '', d.label));
    b.appendChild(el('b', '', state[d.k] ? d.yes : d.no));
    b.onclick = () => { state[d.k] = !state[d.k]; buildDec(); refresh(); };
    box.appendChild(b);
  }
}

function updateAsk() {
  const asked = askedSet();
  let missing = 0;
  for (const q of MEASURES) {
    const done = asked.has(q.k);
    if (!done) missing++;
    askRow[q.k].classList.toggle('done', done);
    askRow[q.k].classList.toggle('todo', !done);
  }
  const c = $('qCount');
  c.textContent = missing ? `${MEASURES.length - missing}/${MEASURES.length} misurate` : 'tutte misurate';
  c.classList.toggle('zero', missing === 0);
}

// ------------------------------------------------------------- altri controlli
function buildSelectors() {
  const prof = $('profile');
  for (const p of PROFILES) {
    const o = el('option', '', p.label);
    o.value = String(p.section);
    o.selected = p.section === state.profileSection;
    prof.appendChild(o);
  }
  prof.onchange = () => {
    const p = PROFILES.find((x) => x.section === Number(prof.value));
    state.profileSection = p.section;
    state.profileWall = p.wall;
    refresh();
  };

  const px = $('plexi');
  for (const t of PLEXI_OPTIONS) {
    const o = el('option', '', `${t} mm`);
    o.value = String(t);
    o.selected = t === state.plexi;
    px.appendChild(o);
  }
  px.onchange = () => { state.plexi = Number(px.value); refresh(); };

  for (const id of ['clearW', 'clearD']) {
    const s = $(id);
    s.value = String(state[id]);
    s.oninput = () => { state[id] = Number(s.value); refresh(); };
  }
}

const shelfLoad = {};
function buildShelves() {
  const box = $('shelfList');
  box.textContent = '';
  for (const sh of state.shelves) {
    const row = el('div', 'shelf');
    row.appendChild(el('span', 'name', sh.label));
    const inp = el('input');
    inp.type = 'number'; inp.min = '20'; inp.max = '240'; inp.step = '5';
    inp.value = String(sh.clearH);
    inp.oninput = () => { sh.clearH = Math.max(20, Number(inp.value) || 20); refresh(); };
    row.appendChild(inp);
    const load = el('span', 'load');
    row.appendChild(load);
    shelfLoad[sh.id] = load;
    box.appendChild(row);
  }
}

$('addShelf').onclick = () => {
  state.shelves.push({ id: `s${Date.now()}`, label: `L${state.shelves.length + 1}`, clearH: 70 });
  buildShelves(); refresh();
};
$('delShelf').onclick = () => {
  if (state.shelves.length <= 1) return;
  const gone = state.shelves.pop();
  delete shelfLoad[gone.id];
  for (const m of MODULES) if (state.placements[m.id] === gone.id) setPlacement(m.id, 'none');
  buildShelves(); refresh();
};

// ------------------------------------------------------------------ readout
function renderVerdicts(plan) {
  const box = $('verdicts');
  box.textContent = '';
  for (const id of ['case', 'bag']) {
    const f = plan.fits[id];
    const cls = f.ok ? (f.soft ? 'soft' : 'ok') : 'fail';
    const card = el('div', `verdict ${cls}`);
    const top = el('div', 'top');
    top.appendChild(el('span', 'name', id === 'case' ? 'registro del ripiano' : 'borsa Samas'));
    top.appendChild(el('span', 'state', f.ok ? (f.soft ? 'fuori, concesso' : 'sta dentro') : 'non sta'));
    card.appendChild(top);
    card.appendChild(el('div', 'envdim', `libero ${f.free.w} x ${f.free.d} x ${f.free.h} · telaio ${plan.c.w} x ${plan.c.d} x ${plan.c.h}`));
    box.appendChild(card);
  }
}

function renderIssues(plan) {
  const box = $('issues');
  box.textContent = '';
  if (!plan.issues.length) { box.appendChild(el('li', '', 'nessun problema geometrico rilevato')); return; }
  for (const i of plan.issues) {
    const li = el('li', i.level);
    li.appendChild(el('span', 'where', i.where));
    li.appendChild(document.createTextNode(i.text));
    box.appendChild(li);
  }
}

function buildKit() {
  const box = $('kitList');
  box.textContent = '';
  for (const m of MODULES) {
    const row = el('div', 'kit' + (selected === m.id ? ' sel' : ''));
    row.dataset.id = m.id;
    const sw = el('span', 'sw');
    sw.style.background = `#${COLORS[m.id].toString(16).padStart(6, '0')}`;
    row.appendChild(sw);
    const txt = el('div', 'txt');
    txt.appendChild(el('b', '', m.label));
    txt.appendChild(el('span', '', `${m.w} x ${m.d} x ${m.h} mm · ${m.kg} kg${state.placeX[m.id] != null ? ` · x=${Math.round(state.placeX[m.id])}` : ''}`));
    txt.appendChild(tagOf(m.source));
    row.appendChild(txt);
    const sel = el('select');
    const none = el('option', '', 'fuori');
    none.value = 'none';
    none.selected = (state.placements[m.id] || 'none') === 'none';
    sel.appendChild(none);
    for (const sh of state.shelves) {
      const o = el('option', '', sh.label);
      o.value = sh.id;
      o.selected = state.placements[m.id] === sh.id;
      sel.appendChild(o);
    }
    sel.onchange = () => { setPlacement(m.id, sel.value); refresh(); };
    row.appendChild(sel);
    row.onclick = (e) => {
      if (e.target === sel) return;
      selected = selected === m.id ? null : m.id;
      view.setSelected(selected);
      buildKit();
    };
    box.appendChild(row);
  }
}

function renderEnv(plan) {
  $('carrierBox').textContent = `${plan.c.w} x ${plan.c.d} x ${plan.c.h} mm`;
  $('carrierSub').textContent = `luce ${plan.c.clearW} x ${plan.c.clearD} + pareti da ${plan.c.p} mm; ${plan.c.chain.length} livelli`;
  $('weightBox').textContent = `peso: telaio ~${plan.frameKg} kg + kit ${plan.kitKg} kg = ${plan.totalKg} kg`
    + (state.m.guideKg ? ` · guide ${state.m.guideKg} kg` : ' · portata guide non misurata (A14)');
}

function renderLegend() {
  const box = $('legend');
  box.textContent = '';
  const rows = state.showDims
    ? [['#b3491a', 'quota misurata (domanda A/B)'], ['#2d3142', 'quota del telaio']]
    : [];
  for (const [col, txt] of rows) {
    const p = el('div');
    const i = el('i'); i.style.background = col;
    p.appendChild(i); p.appendChild(document.createTextNode(txt));
    box.appendChild(p);
  }
}

// --------------------------------------------------------------- esporta
function shareUrl() {
  return location.href.split('?')[0] + '?' + encodeState(snapshot());
}

function updateExport(plan) {
  $('exportBox').value = reportText(snapshot(), askedSet(), plan);
}

async function copy(text, note) {
  try {
    await navigator.clipboard.writeText(text);
    $('linkNote').textContent = note + ' copiato negli appunti';
  } catch {
    const box = document.createElement('textarea');
    box.value = text;
    document.body.appendChild(box);
    box.select();
    document.execCommand('copy');
    box.remove();
    $('linkNote').textContent = note + ' copiato (fallback)';
  }
}

$('copyBtn').onclick = () => copy($('exportBox').value, 'testo misure');
$('linkBtn').onclick = () => {
  const u = shareUrl();
  $('linkNote').textContent = u.length + ' caratteri: ';
  copy(u, 'link');
};
$('loadLinkBtn').onclick = () => {
  const u = prompt('incolla il link ricevuto');
  if (!u) return;
  const snap = decodeState(u.slice(u.indexOf('?')));
  if (!snap) { $('linkNote').textContent = 'link senza misure dentro'; return; }
  restore(snap);
  buildShelves(); buildAsk(); buildDec();
  $('linkNote').textContent = 'misure caricate dal link';
  refresh();
};

// ------------------------------------------------------------ scena <-> stato
view.onHover((id) => {
  const m = MODULES.find((x) => x.id === id);
  $('hoverline').textContent = m
    ? `${m.label} · ${m.w} x ${m.d} x ${m.h} mm · ${m.kg} kg${m.note ? ' · ' + m.note : ''}`
    : 'passa sopra un modulo per il nome';
});
view.onSelect((id) => { selected = selected === id ? null : id; view.setSelected(selected); buildKit(); });
view.onMove((id, shelfId, x) => {
  state.placements[id] = shelfId;
  state.placeX[id] = x;
  refresh();
});

for (const b of $('viewBtns').children) {
  b.onclick = () => {
    if (b.dataset.view === 'dims') {
      state.showDims = !state.showDims;
      b.classList.toggle('on', state.showDims);
      renderLegend();
      refresh();
      return;
    }
    for (const o of $('viewBtns').children) if (o.dataset.view !== 'dims') o.classList.toggle('on', o === b);
    view.setView(b.dataset.view);
  };
}

addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select')) return;
  const map = { '1': 'iso', '2': 'front', '3': 'side', '4': 'top' };
  if (map[e.key]) { view.setView(map[e.key]); return; }
  if (e.key === 'q') {
    state.showDims = !state.showDims;
    $('dimsBtn').classList.toggle('on', state.showDims);
    renderLegend(); refresh();
  }
});

// --------------------------------------------------------------------- loop
function refresh() {
  const plan = analyse();
  const bad = new Set(plan.rows.filter((r) => r.bad).flatMap((r) => r.placed.map((p) => p.m.id)));
  $('clearWv').textContent = String(state.clearW);
  $('clearDv').textContent = String(state.clearD);
  for (const sh of state.shelves) {
    const row = plan.rows.find((r) => r.shelf.id === sh.id);
    if (shelfLoad[sh.id]) shelfLoad[sh.id].textContent = row ? `${row.mods.length} mod · ${row.load.toFixed(1)} kg` : '';
  }
  renderEnv(plan);
  renderVerdicts(plan);
  renderIssues(plan);
  updateAsk();
  updateExport(plan);
  view.draw({
    s: plan.s, bag: plan.bag,
    shell: plan.shell, rec: plan.r, c: plan.c, rows: plan.rows,
    colors: COLORS, bad, dims: state.showDims,
  });
}

// avvio: se l'URL porta misure da un link condiviso, caricali prima di segnare
// le domande come mancanti.
const incoming = decodeState(location.search);
if (incoming) { restore(incoming); }

buildTabs();
buildAsk();
buildDec();
buildSelectors();
buildShelves();
buildKit();
renderLegend();
refresh();
