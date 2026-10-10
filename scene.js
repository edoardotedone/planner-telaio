// scene.js — disegno 3D del telaio dentro il registro, con le quote disegnate
// e i moduli trascinabili. Orbit camera scritta qui (niente OrbitControls,
// niente import bare "three", niente import map).
//
// draw(plan) riceve tutto dal modello, non legge lo stato:
//   plan = { shell, rec, c, rows, colors, bad, dims, selected }

import * as THREE from './lib/three.module.min.js';

const S = 0.001; // mm -> unita di scena

const C = {
  ink: 0x2d3142,
  rule: 0xbfc0c0,
  accent: 0xeb6c36,
  // La borsa si legge come una coppia: arancio chiaro = pelle esterna (B1-B3),
  // arancio scuro = spazio libero dentro (esterno meno imbottitura B4).
  bagOuter: 0xf7d8bf,
  bagOuterEdge: 0xd98a52,
  bagInner: 0xb3491a,
  bad: 0xb3261e,
  glass: 0x8ea6b4,
  carpet: 0x4b4f5a,
  alu: 0xbfc0c0,
  caseEdge: 0x6f7787,
};
const INK_CSS = '#2d3142';
const ACCENT_CSS = '#b3491a';

const VIEWS = {
  iso: { theta: 0.72, phi: 1.12 },
  // Angoli esatti: in ortografica uno scostamento di 2 millesimi di radiante non si
  // vede (sposta lo spigolo di ~0.5 mm su 470), ma evita il polo esatto, dove la
  // rotazione azimutale della camera non produce alcun movimento dell'immagine.
  front: { theta: 0.0, phi: Math.PI / 2, ortho: true },
  side: { theta: Math.PI / 2, phi: Math.PI / 2, ortho: true },
  top: { theta: 0.0, phi: 0.002, ortho: true },
};
// Campo visivo verticale in gradi: lo condividono prospettiva e ortografica,
// cosi` `radius` significa lo stesso ingrandimento in entrambe.
const FOV = 28;

function boxMesh(w, h, d, color, opacity = 1) {
  const geo = new THREE.BoxGeometry(w * S, h * S, d * S);
  const mat = new THREE.MeshLambertMaterial({
    color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
  });
  return new THREE.Mesh(geo, mat);
}

function edgeOf(geo, color, opacity = 1) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
}

function line(points, color, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity,
  }));
}

// Etichetta-quota: canvas -> texture -> sprite. Grandezza in mm di scena, cosi
// resta leggibile come una quota di disegno tecnico quando si zooma.
function label(text, cssColor = INK_CSS, heightMM = 15) {
  const px = 26; // altezza del glifo nel canvas
  const pad = 8;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `600 ${px}px InstrumentSans, sans-serif`;
  const wTxt = Math.ceil(ctx.measureText(text).width);
  cv.width = wTxt + pad * 2;
  cv.height = px + pad * 2;
  const g = cv.getContext('2d');
  g.font = `600 ${px}px InstrumentSans, sans-serif`;
  g.fillStyle = 'rgba(251,250,248,0.86)';
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = cssColor;
  g.textBaseline = 'middle';
  g.fillText(text, pad, cv.height / 2);

  const tex = new THREE.CanvasTexture(cv);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
  const h = heightMM * S;
  sprite.scale.set((cv.width / cv.height) * h, h, 1);
  sprite.renderOrder = 50;
  return sprite;
}

// Segmento di quota con tick alle estremita + etichetta a meta.
function dim(a, b, color, css, text, off = null) {
  const g = new THREE.Group();
  const va = new THREE.Vector3(a[0] * S, a[1] * S, a[2] * S);
  const vb = new THREE.Vector3(b[0] * S, b[1] * S, b[2] * S);
  g.add(line([va, vb], color, 0.9));
  const tick = 6; // mm
  const axis = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]) ? 0 : 2;
  for (const p of [va, vb]) {
    const t1 = p.clone(); const t2 = p.clone();
    t1[axis] += tick * S; t2[axis] -= tick * S;
    g.add(line([t1, t2], color, 0.9));
  }
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  if (off) mid.add(new THREE.Vector3(off[0] * S, off[1] * S, off[2] * S));
  const lab = label(text, css);
  lab.position.copy(mid);
  g.add(lab);
  return g;
}

export class View {
  constructor(container) {
    this.container = container;
    this.orbit = { theta: VIEWS.iso.theta, phi: VIEWS.iso.phi, radius: 1.2 };
    this.fitR = 1.2;
    this.userZoom = false;
    this.pickables = [];
    this.target = new THREE.Vector3();
    this.hoverCb = null;
    this.selectCb = null;
    this.moveCb = null;
    this.hovered = null;
    this.dragging = null;
    this.plan = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bbb8, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(0.7, 1.4, 0.9);
    this.scene.add(dir);

    // Due camere: `iso` in prospettiva, fronte/fianco/dall'alto ortografica
    // (un modulo da 320 mm occupa 320 mm sulla tela: si puo' misurare a occhio).
    this.camPersp = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);
    this.camOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    this.camera = this.camPersp;
    this.ortho = false;
    this.aspect = 1;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane();

    this.#bindPointer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  #bindPointer() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      const hit = this.#hit(e);
      if (hit) {
        // Trascinamento modulo: il mouse comanda il piano d'appoggio di quel
        // livello; in X sposta il modulo, in Y lo cambia livello.
        const row = this.plan.rows.find((r) => r.placed.some((p) => p.m.id === hit.object.userData.id));
        const item = row.placed.find((p) => p.m.id === hit.object.userData.id);
        const levelIdx = this.plan.rows.indexOf(row);
        this.plane.set(new THREE.Vector3(0, (this.plan.c.chain[levelIdx].levelY + item.m.h / 2) * S, 0), new THREE.Vector3(0, 1, 0));
        this.dragging = {
          id: hit.object.userData.id, mesh: hit.object, item, levelIdx, levelFrom: levelIdx,
          x: e.clientX, y: e.clientY, moved: 0,
        };
        el.style.cursor = 'grabbing';
      } else {
        this.dragging = { orbit: true, x: e.clientX, y: e.clientY, theta: this.orbit.theta, phi: this.orbit.phi };
      }
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const d = this.dragging;
      if (!d) { this.#pick(e); return; }
      if (d.orbit) {
        // Banda polare larga: il preset `dall'alto` vive a phi ~ 0 e deve poter
        // oscillare attorno al suo preset. A phi = 0 la `up` del mondo e' parallela
        // alla direzione di vista, quindi si resta a 0.002 radianti.
        this.orbit.phi = clamp(d.phi - (e.clientY - d.y) * 0.008, 0.002, Math.PI - 0.06);
        this.orbit.theta = d.theta - (e.clientX - d.x) * 0.008;
        this.#applyCamera();
        this.render();
        return;
      }
      d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x), Math.abs(e.clientY - d.y));
      if (d.moved < 3) return;

      // Y -> cambio livello (45 px di schermo = un livello)
      const step = Math.round((d.y - e.clientY) / 45);
      const idx = clamp(d.levelFrom + step, 0, this.plan.rows.length - 1);
      if (idx !== d.levelIdx) {
        d.levelIdx = idx;
        d.mesh.position.y = (this.plan.c.chain[idx].levelY + d.item.m.h / 2) * S;
        this.plane.set(new THREE.Vector3(0, (this.plan.c.chain[idx].levelY + d.item.m.h / 2) * S, 0), new THREE.Vector3(0, 1, 0));
      }
      // X -> posizione sul livello
      this.ndc.set(
        ((e.clientX - this.renderer.domElement.getBoundingClientRect().left) / this.renderer.domElement.clientWidth) * 2 - 1,
        -((e.clientY - this.renderer.domElement.getBoundingClientRect().top) / this.renderer.domElement.clientHeight) * 2 + 1,
      );
      this.ray.setFromCamera(this.ndc, this.camera);
      const p = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, p)) {
        const half = this.plan.c.clearW / 2;
        const mm = clamp(p.x / S + half, 0, Math.max(0, this.plan.c.clearW - d.item.m.w));
        d.item.x = mm;
        d.mesh.position.x = (-half + mm + d.item.m.w / 2) * S;
        if (d.mesh.userData.edge) d.mesh.userData.edge.position.copy(d.mesh.position);
      }
      this.render();
    });

    el.addEventListener('pointerup', (e) => {
      const d = this.dragging;
      this.dragging = null;
      this.renderer.domElement.style.cursor = this.hovered ? 'grab' : '';
      if (!d) return;
      if (d.orbit) return;
      if (d.moved < 3) {
        if (this.selectCb) this.selectCb(d.id);
        return;
      }
      if (this.moveCb) {
        this.moveCb(d.id, this.plan.rows[d.levelIdx].shelf.id, Math.round(d.item.x));
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.userZoom = true;
      this.orbit.radius = clamp(this.orbit.radius * (1 + Math.sign(e.deltaY) * 0.08), this.fitR * 0.25, this.fitR * 3);
      this.#applyCamera();
      this.render();
    }, { passive: false });
  }

  #hit(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.intersectObjects(this.pickables, false)[0] || null;
  }

  #pick(e) {
    const hit = this.#hit(e);
    const id = hit ? hit.object.userData.id : null;
    if (id !== this.hovered) {
      this.hovered = id;
      this.renderer.domElement.style.cursor = id ? 'grab' : '';
      this.#paintHover();
      if (this.hoverCb) this.hoverCb(id);
    }
  }

  #paintHover() {
    for (const mesh of this.pickables) {
      const eg = mesh.userData.edge;
      if (!eg) continue;
      const sel = mesh.userData.id === this.selected;
      const hov = mesh.userData.id === this.hovered;
      eg.material.color.setHex(sel || hov ? C.accent : mesh.userData.edgeColor);
      eg.material.opacity = sel || hov ? 1 : 0.75;
    }
    this.render();
  }

  setSelected(id) {
    this.selected = id;
    this.#paintHover();
  }

  setView(name) {
    const v = VIEWS[name] || VIEWS.iso;
    this.ortho = !!v.ortho;
    this.camera = this.ortho ? this.camOrtho : this.camPersp;
    this.orbit.theta = v.theta;
    this.orbit.phi = v.phi;
    this.orbit.radius = this.fitR;
    this.userZoom = false;
    this.#applyCamera();
    this.render();
  }

  onHover(cb) { this.hoverCb = cb; }
  onSelect(cb) { this.selectCb = cb; }
  onMove(cb) { this.moveCb = cb; }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.#applyCamera();
    this.render();
  }

  #applyCamera() {
    const { theta, phi, radius } = this.orbit;
    for (const cam of [this.camPersp, this.camOrtho]) {
      cam.position.set(
        this.target.x + radius * Math.sin(phi) * Math.sin(theta),
        this.target.y + radius * Math.cos(phi),
        this.target.z + radius * Math.sin(phi) * Math.cos(theta),
      );
      cam.lookAt(this.target);
    }
    this.camPersp.aspect = this.aspect;
    this.camPersp.updateProjectionMatrix();
    // In ortografica l'inquadratura si controlla con il frustum: meta' altezza =
    // raggio * tan(FOV/2), identica a cio' che vede la prospettiva a quella distanza.
    const halfH = radius * Math.tan((FOV * Math.PI) / 360);
    const halfW = halfH * this.aspect;
    this.camOrtho.left = -halfW;
    this.camOrtho.right = halfW;
    this.camOrtho.top = halfH;
    this.camOrtho.bottom = -halfH;
    this.camOrtho.updateProjectionMatrix();
  }

  draw(plan) {
    this.root.clear();
    this.pickables = [];
    this.plan = plan;
    const { shell, rec, c, rows, bag } = plan;
    const m = plan.s.m;
    // `borsa Samas` nella barra in alto scambia il contenitore disegnato: la
    // cassa SKB, il telaio del ripiano e le quote A spariscono, entra la borsa.
    const bagMode = plan.s.envelope === 'bag';

    // Guscio cassa: quasi solo spigoli, deve restare sfondo.
    const shellGeo = new THREE.BoxGeometry(shell.w * S, shell.h * S, shell.d * S);
    const sh = new THREE.Mesh(shellGeo, new THREE.MeshLambertMaterial({
      color: C.rule, transparent: true, opacity: 0.04, depthWrite: false,
    }));
    sh.position.y = (shell.h / 2) * S;
    if (!bagMode) this.root.add(sh);
    const shellEdge = edgeOf(shellGeo, C.caseEdge, 0.9);
    shellEdge.position.copy(sh.position);
    if (!bagMode) this.root.add(shellEdge);

    // Ripiano scorrevole: cornice di profilato + piano in moquette. La cornice
    // sporge `lip` sopra il piano e fa da registro.
    const barH = rec.floor + rec.lip;
    const carpet = boxMesh(rec.w - 6, 3, rec.d - 6, C.carpet, 1);
    carpet.position.y = (rec.floor - 1.5) * S;
    if (!bagMode) this.root.add(carpet);
    const bars = [
      [shell.w, rec.bar, 0, -(shell.d / 2 - rec.bar / 2)],
      [shell.w, rec.bar, 0, shell.d / 2 - rec.bar / 2],
      [rec.barShort, shell.d - 2 * rec.bar, -(shell.w / 2 - rec.barShort / 2), 0],
      [rec.barShort, shell.d - 2 * rec.bar, shell.w / 2 - rec.barShort / 2, 0],
    ];
    for (const [bw, bd, bx, bz] of bars) {
      const bar = boxMesh(bw, barH, bd, C.alu, 0.95);
      bar.position.set(bx * S, (barH / 2) * S, bz * S);
      if (!bagMode) this.root.add(bar);
    }

    if (bagMode) {
      // Borsa: guscio esterno (misure B1-B4) + volume libero interno, cioe'
      // l'esterno meno l'imbottitura (B4).
      const outer = boxMesh(m.bagW, m.bagH, m.bagD, C.bagOuter, 0.34);
      outer.position.y = (m.bagH / 2) * S;
      this.root.add(outer);
      const oe = edgeOf(outer.geometry, C.bagOuterEdge, 0.95);
      oe.position.copy(outer.position);
      this.root.add(oe);
      const inner = edgeOf(new THREE.BoxGeometry(bag.w * S, bag.h * S, bag.d * S), C.bagInner, 1);
      inner.position.y = (m.bagPad + bag.h / 2) * S;
      this.root.add(inner);
    }

    const g = new THREE.Group();
    g.position.y = (bagMode ? m.bagPad : rec.floor) * S;
    this.root.add(g);

    const frameColor = plan.carrierBad ? C.bad : C.ink;
    const ring = (yBottom, color) => {
      for (const sz of [-1, 1]) {
        const beam = boxMesh(c.w - 2 * c.p, c.p, c.p, color);
        beam.position.set(0, (yBottom + c.p / 2) * S, sz * (c.d / 2 - c.p / 2) * S);
        g.add(beam);
      }
      for (const sx of [-1, 1]) {
        const beam = boxMesh(c.p, c.p, c.d - 2 * c.p, color);
        beam.position.set(sx * (c.w / 2 - c.p / 2) * S, (yBottom + c.p / 2) * S, 0);
        g.add(beam);
      }
    };
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = boxMesh(c.p, c.h, c.p, frameColor);
        post.position.set(sx * (c.w / 2 - c.p / 2) * S, (c.h / 2) * S, sz * (c.d / 2 - c.p / 2) * S);
        g.add(post);
      }
    }
    ring(0, frameColor);

    for (const row of rows) {
      const link = c.chain.find((ch) => ch.id === row.shelf.id);
      const panel = boxMesh(c.clearW, c.t, c.clearD, C.glass, 1);
      panel.position.y = (link.panelY + c.t / 2) * S;
      g.add(panel);
      const pe = edgeOf(panel.geometry, C.caseEdge, 1);
      pe.position.copy(panel.position);
      g.add(pe);

      for (const item of row.placed) {
        const bad = row.bad.has(item.m.id);
        const color = bad ? C.bad : (plan.colors[item.m.id] || C.ink);
        const mesh = boxMesh(item.m.w, item.m.h, item.m.d, color, 1);
        mesh.position.set(
          (-c.clearW / 2 + item.x + item.m.w / 2) * S,
          (link.levelY + item.m.h / 2) * S,
          0,
        );
        mesh.userData.id = item.m.id;
        mesh.userData.edgeColor = bad ? C.bad : C.ink;
        g.add(mesh);
        this.pickables.push(mesh);
        const eg = edgeOf(mesh.geometry, mesh.userData.edgeColor, 0.75);
        eg.position.copy(mesh.position);
        mesh.userData.edge = eg;
        g.add(eg);
      }
    }
    ring(c.h - c.p, frameColor);

    // Quote disegnate.
    if (plan.dims) {
      if (bagMode) {
        const bzF = m.bagD / 2;
        const bxR = m.bagW / 2;
        this.root.add(dim([-bxR, m.bagPad, bzF + 14], [bxR, m.bagPad, bzF + 14], C.accent, ACCENT_CSS, `B1 larghezza ${m.bagW}`));
        this.root.add(dim([bxR + 14, m.bagPad, -bzF], [bxR + 14, m.bagPad, bzF], C.accent, ACCENT_CSS, `B2 profondita ${m.bagD}`));
        this.root.add(dim([-bxR - 14, 0, -bzF + 10], [-bxR - 14, m.bagH, -bzF + 10], C.accent, ACCENT_CSS, `B3 altezza ${m.bagH}`));
        g.add(dim([-bag.w / 2, m.bagPad - 1, bag.d / 2 + 2], [bag.w / 2, m.bagPad - 1, bag.d / 2 + 2], C.bagInner, ACCENT_CSS, `libero ${bag.w} x ${bag.d} x ${bag.h}`));
      }
      const zF = shell.d / 2; // fronte
      const xR = shell.w / 2;
      if (!bagMode) {
      this.root.add(dim([-rec.w / 2, rec.floor, zF + 14], [rec.w / 2, rec.floor, zF + 14], C.accent, ACCENT_CSS, `A9 larghezza ${rec.w}`));
      this.root.add(dim([xR + 14, rec.floor, -rec.d / 2], [xR + 14, rec.floor, rec.d / 2], C.accent, ACCENT_CSS, `A9 profondita ${rec.d}`));
      this.root.add(dim([-xR - 14, rec.floor, -rec.d / 2 + 10], [-xR - 14, rec.floor + rec.h, -rec.d / 2 + 10], C.accent, ACCENT_CSS, `A13 altezza utile ${rec.h}`));
      }
      g.add(dim([-c.w / 2 - 10, 0, -c.d / 2], [-c.w / 2 - 10, 0, c.d / 2], C.ink, INK_CSS, `telaio ${c.d} profondo`));
      g.add(dim([-c.w / 2, 0, c.d / 2 + 10], [c.w / 2, 0, c.d / 2 + 10], C.ink, INK_CSS, `telaio ${c.w} largo`));
      for (const row of rows) {
        const ch = c.chain.find((k) => k.id === row.shelf.id);
        g.add(dim(
          [c.w / 2 + 12, ch.levelY, c.d / 2 - 10],
          [c.w / 2 + 12, ch.levelY + ch.clearH, c.d / 2 - 10],
          C.ink, INK_CSS, `${row.shelf.label} residuo ${ch.clearH}`,
        ));
      }
    }

    const env = bagMode ? [m.bagW, m.bagD, m.bagH] : [shell.w, shell.d, shell.h];
    const maxDim = Math.max(c.w, c.d, c.h, env[0], env[1], env[2]) * S;
    this.fitR = ((maxDim * 0.5) / Math.tan((FOV * Math.PI) / 360)) * 1.9;
    if (!this.userZoom) this.orbit.radius = this.fitR;
    const topY = bagMode ? Math.max(c.h + m.bagPad, m.bagH) : Math.max(c.h + rec.floor, shell.h);
    this.target.set(0, topY * S * 0.5, 0);
    this.#applyCamera();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
