// FX (tracers, explosions, rain) + data-driven level builder + Missions 1 & 2.

const FX = {
  scene: null, items: [], rain: null, rainVel: null,
  init(scene) { this.scene = scene; this.items = []; this.rain = null; },
  tracer(a, b, color) {
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: color || 0xffe0a0, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);
    this.items.push({ obj: line, life: 0.09, fade: m => { m.material.opacity = 0; } });
  },
  impact(p) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 1 }));
    m.position.copy(p);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.12 });
  },
  explosion(p, big) {
    AudioSys.play('explosion');
    const r = big ? 4 : 2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95 }));
    m.position.copy(p);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.5, tick: (it, dt) => { it.obj.scale.multiplyScalar(1 + dt * 14); it.obj.material.opacity -= dt * 2; } });
    Player.shake = Math.min(1, Player.shake + (big ? 0.5 : 0.3));
  },
  startRain(scene) {
    const N = 600, pos = new Float32Array(N * 3);
    this.rainVel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = U.rand(-60, 60); pos[i * 3 + 1] = U.rand(0, 30); pos[i * 3 + 2] = U.rand(-60, 60);
      this.rainVel.push(U.rand(18, 26));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6a7884, size: 0.08, transparent: true, opacity: 0.55 }));
    scene.add(this.rain);
  },
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.tick) it.tick(it, dt);
      if (it.life <= 0) { this.scene.remove(it.obj); this.items.splice(i, 1); }
    }
    if (this.rain) {
      const p = this.rain.geometry.attributes.position;
      const px = Player.pos;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - this.rainVel[i] * dt;
        if (y < 0) {
          y = U.rand(22, 30);
          p.setX(i, px.x + U.rand(-50, 50));
          p.setZ(i, px.z + U.rand(-50, 50));
        }
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
  },
};

// ---- level builder ----
// geo entry: {p:[x,y,z] center, s:[sx,sy,sz], t:'tex', rep:[u,v]?, nosolid?, tag?, glow?}
function gbox(x, y, z, sx, sy, sz, t, extra) {
  return Object.assign({ p: [x, y, z], s: [sx, sy, sz], t }, extra || {});
}
// room walls with optional door gaps; doors: array of {side:'n|s|e|w', off, w, h}. yBase = floor height.
function groomWalls(cx, cz, w, d, h, t, doors, out, yBase) {
  doors = doors || [];
  yBase = yBase || 0;
  const th = 0.5, hy = h / 2;
  const segs = { n: [], s: [], e: [], w: [] };
  for (const side of ['n', 's', 'e', 'w']) {
    const len = (side === 'n' || side === 's') ? w : d;
    const ds = doors.filter(dd => dd.side === side).sort((a, b) => a.off - b.off);
    let cur = -len / 2;
    const pieces = [];
    for (const dd of ds) {
      const a = dd.off - dd.w / 2, b = dd.off + dd.w / 2;
      if (a > cur) pieces.push([cur, a]);
      // lintel above door
      pieces.push([a, b, dd.h]);
      cur = b;
    }
    if (cur < len / 2) pieces.push([cur, len / 2]);
    for (const pc of pieces) {
      const mid = (pc[0] + pc[1]) / 2, plen = pc[1] - pc[0];
      if (plen <= 0.01) continue;
      const lintelBase = pc[2];
      const py = yBase + (lintelBase ? lintelBase + (h - lintelBase) / 2 : hy);
      const ph = lintelBase ? h - lintelBase : h;
      if (ph <= 0.01) continue;
      if (side === 'n') out.push(gbox(cx + mid, py, cz - d / 2, plen, ph, th, t));
      if (side === 's') out.push(gbox(cx + mid, py, cz + d / 2, plen, ph, th, t));
      if (side === 'w') out.push(gbox(cx - w / 2, py, cz + mid, th, ph, plen, t));
      if (side === 'e') out.push(gbox(cx + w / 2, py, cz + mid, th, ph, plen, t));
    }
  }
}
function container(x, z, yaw, tex, out) {
  out.push(gbox(x, 1.3, z, yaw ? 2.6 : 6.5, 2.6, yaw ? 6.5 : 2.6, tex || 'container'));
}
function lamp(x, z, h, out, color) {
  out.push(gbox(x, h / 2, z, 0.25, h, 0.25, 'metal'));
  out.push(gbox(x, h + 0.15, z, 0.7, 0.3, 0.7, 'metal'));
  out.push(gbox(x, h - 0.06, z, 0.5, 0.14, 0.5, 'metal', { basic: color || 0xffe2a8, nosolid: true }));
}
function barrels(x, z, out) {
  out.push(gbox(x, 0.55, z, 0.9, 1.1, 0.9, 'barrel', { cyl: true }));
  out.push(gbox(x + 0.95, 0.55, z + 0.3, 0.9, 1.1, 0.9, 'barrel', { cyl: true }));
  out.push(gbox(x + 0.4, 0.55, z - 0.75, 0.9, 1.1, 0.9, 'barrel', { cyl: true }));
}

function buildLevel(def, scene) {
  World.clear();
  Game.tagged = {};
  const env = def.env;
  scene.background = new THREE.Color(env.sky);
  scene.fog = new THREE.Fog(env.fog[0], env.fog[1], env.fog[2]);
  scene.add(new THREE.AmbientLight(env.ambient, env.ambientI || 0.7));
  const sun = new THREE.DirectionalLight(env.sunColor || 0x9aa4b0, env.sunI || 0.6);
  sun.position.set(env.sunDir ? env.sunDir[0] : 20, env.sunDir ? env.sunDir[1] : 40, env.sunDir ? env.sunDir[2] : 10);
  scene.add(sun);

  const geo = def.geo();
  for (const g of geo) {
    let mat;
    if (g.basic != null) mat = new THREE.MeshBasicMaterial({ color: g.basic });
    else if (g.rep) {
      const t = Tex.get(g.t).clone();
      t.needsUpdate = true; t.repeat.set(g.rep[0], g.rep[1]);
      mat = new THREE.MeshLambertMaterial({ map: t });
    } else mat = g.glow ? Tex.mat(g.t, { emissive: 0x553300 }) : Tex.mat(g.t);
    const shape = g.cyl
      ? new THREE.CylinderGeometry(g.s[0] / 2, g.s[0] / 2, g.s[1], 8)
      : new THREE.BoxGeometry(g.s[0], g.s[1], g.s[2]);
    const mesh = new THREE.Mesh(shape, mat);
    mesh.position.set(g.p[0], g.p[1], g.p[2]);
    scene.add(mesh);
    let boxRef = null;
    if (!g.nosolid) boxRef = World.addBox(g.p[0], g.p[1], g.p[2], g.s[0], g.s[1], g.s[2], g.tag);
    if (g.tag) {
      if (!Game.tagged[g.tag]) Game.tagged[g.tag] = [];
      Game.tagged[g.tag].push({ mesh, box: boxRef });
    }
  }
  if (env.rain) FX.startRain(scene);
}

// ============ MISSION 1 — COLD OPEN (dockyard, night, rain) ============
const M1 = {
  id: 0, name: 'COLD OPEN', target: 240,
  env: { sky: 0x070a10, fog: [0x070a10, 12, 70], ambient: 0x46505e, ambientI: 0.85, sunColor: 0x5a6a80, sunI: 0.35, rain: true },
  playerStart: { pos: [0, 0.5, 56], yaw: 0 },
  geo() {
    const o = [];
    o.push(gbox(0, -0.5, 0, 130, 1, 150, 'asphalt', { rep: [16, 18] }));            // dock ground
    o.push(gbox(0, -2, 95, 200, 1, 40, 'water', { rep: [20, 6], nosolid: true }));  // sea behind spawn
    o.push(gbox(-65.5, 3, 0, 1, 8, 150, 'concrete')); o.push(gbox(65.5, 3, 0, 1, 8, 150, 'concrete')); // bounds
    o.push(gbox(0, 3, 75.5, 130, 8, 1, 'concrete'));
    // container yard (cover lanes)
    container(-12, 38, 0, 'container', o); container(-4, 30, 1, 'rust', o);
    container(10, 36, 0, 'container', o); container(16, 26, 1, 'container', o);
    container(-18, 22, 1, 'rust', o);     container(2, 18, 0, 'container', o);
    container(-8, 8, 0, 'rust', o);       container(14, 12, 1, 'container', o);
    o.push(gbox(-14, 3.9, 38, 6.5, 2.6, 2.6, 'rust')); // stacked
    o.push(gbox(6, 0.8, 24, 1.6, 1.6, 1.6, 'crate')); o.push(gbox(7.6, 0.8, 24.4, 1.6, 1.6, 1.6, 'crate'));
    o.push(gbox(6.8, 2.4, 24.2, 1.6, 1.6, 1.6, 'crate'));
    // warehouse (z -28..-56, x -20..20)
    o.push(gbox(0, 8.25, -42, 41, 0.5, 29, 'metal'));   // roof
    groomWalls(0, -42, 40, 28, 8, 'metal', [
      { side: 's', off: 0, w: 4, h: 3.2 },   // breach door (south face, tagged below)
      { side: 'e', off: 6, w: 4, h: 3.2 },   // exit toward crane
    ], o);
    o.push(gbox(0, 1.6, -28, 4, 3.2, 0.5, 'hazard', { tag: 'm1door' })); // breach door fills the gap
    // warehouse interior
    o.push(gbox(-12, 1, -48, 8, 2, 4, 'crate')); o.push(gbox(10, 1.3, -38, 5, 2.6, 5, 'crate'));
    o.push(gbox(-6, 0.8, -34, 1.6, 1.6, 1.6, 'crate'));
    o.push(gbox(0, 0.6, -50, 3, 1.2, 1.5, 'objective', { glow: true })); // manifest console
    // crane pad east
    o.push(gbox(34, 0.25, -48, 18, 0.5, 18, 'metal', { rep: [4, 4] }));
    o.push(gbox(42, 6, -48, 2, 12, 2, 'metal')); o.push(gbox(34, 12.5, -48, 18, 1, 3, 'metal'));
    o.push(gbox(34, 0.9, -48, 6, 1.2, 6, 'hazard', { tag: 'm1lift' })); // elevator platform
    // --- decor ---
    lamp(-20, 45, 5, o); lamp(18, 30, 5, o); lamp(-22, -5, 5, o); lamp(20, -20, 5, o); lamp(28, -60, 5, o);
    barrels(-22, 30, o); barrels(10, 6, o); barrels(-6, -36, o);
    o.push(gbox(12, 0.12, 44, 2.2, 0.24, 2.2, 'crate')); o.push(gbox(-2, 0.12, 48, 2.2, 0.24, 2.2, 'crate')); // pallets
    for (let x = -40; x <= 40; x += 16) o.push(gbox(x, 0.4, 70, 0.5, 0.8, 0.5, 'metal', { cyl: true })); // bollards
    o.push(gbox(-8, 0.02, 36, 4, 0.03, 2.6, 'metal', { basic: 0x1a2530, nosolid: true })); // puddles
    o.push(gbox(14, 0.02, 18, 5, 0.03, 3, 'metal', { basic: 0x1a2530, nosolid: true }));
    o.push(gbox(-16, 0.02, -12, 3.5, 0.03, 2.2, 'metal', { basic: 0x1a2530, nosolid: true }));
    o.push(gbox(-45, 2.5, 88, 50, 9, 12, 'metal', { basic: 0x0c1016, nosolid: true })); // distant ship
    o.push(gbox(-17, 2, -42, 1.2, 4, 10, 'metal')); o.push(gbox(17, 2, -47, 1.2, 4, 9, 'metal')); // shelving
    o.push(gbox(-2.6, 0.9, -50, 0.3, 1.8, 4, 'metal')); o.push(gbox(2.6, 0.9, -50, 0.3, 1.8, 4, 'metal')); // office cage
    o.push(gbox(0, 0.9, -52.4, 5.5, 1.8, 0.3, 'metal'));
    o.push(gbox(42, 12.8, -48, 0.35, 0.35, 0.35, 'metal', { basic: 0xff3020, nosolid: true })); // crane beacon
    return o;
  },
  enemies: [
    { type: 'grunt', pos: [-10, 0, 33], patrol: [[-10, 0, 33], [4, 0, 33]] },
    { type: 'grunt', pos: [12, 0, 22], yaw: 0.5 },
    { type: 'grunt', pos: [-14, 0, 12], patrol: [[-14, 0, 12], [-2, 0, 6]] },
    { type: 'grunt', pos: [6, 0, 2], yaw: 3.1 },
  ],
  objectives: [
    {
      type: 'goto', pos: [0, 1.6, -26], r: 3.5, text: 'Breach the warehouse',
      onStart: {
        radio: [
          ['OVERWATCH', 'Ash, you\'re on the dock. VULKAN moved the BLACKSITE package through here tonight.'],
          ['OVERWATCH', 'Get inside that warehouse and pull the shipping manifest. Quiet or loud — your call.'],
        ],
      },
      tutorial: true,
    },
    {
      type: 'interact', pos: [0, 1.6, -28], r: 3, hold: 1.2, label: 'BREACHING',
      text: 'Breach the door [hold E]',
      onComplete: { removeTag: 'm1door', explodeAt: [[0, 1.6, -28]], spawn: [
        { type: 'grunt', pos: [-8, 0, -46], yaw: 3.1 },
        { type: 'grunt', pos: [8, 0, -44], yaw: 3.1 },
        { type: 'grunt', pos: [0, 0, -52], yaw: 3.1 },
      ] },
      checkpoint: true,
    },
    {
      type: 'interact', pos: [0, 1, -50], r: 3.2, hold: 8, label: 'DOWNLOADING MANIFEST',
      text: 'Download the manifest [hold E]', defendedHint: true,
      onStart: { radio: [['OVERWATCH', 'Console\'s in the back office cage. The download will make noise — hold them off.']],
        spawnAt: 2, spawn: [
          { type: 'grunt', pos: [-16, 0, -30], yaw: 3.1 },
          { type: 'grunt', pos: [16, 0, -32], yaw: 3.1 },
        ] },
      onComplete: { radio: [
        ['OVERWATCH', 'Reading it now... damn. BLACKSITE isn\'t here. They railed it inland six hours ago.'],
        ['OVERWATCH', 'New exfil: the crane elevator, east pad. Move, Sergeant.'],
      ] },
      checkpoint: true,
    },
    {
      type: 'goto', pos: [34, 1, -48], r: 2.5, text: 'Exfil — crane elevator',
      onStart: { spawn: [
        { type: 'grunt', pos: [26, 0, -34], yaw: 2 },
        { type: 'grunt', pos: [40, 0, -38], yaw: 2.6 },
      ] },
      onComplete: { radio: [['OVERWATCH', 'Bird\'s up. Next stop: the switchyard. We\'re not letting that train disappear.']] },
    },
  ],
};

// ============ MISSION 2 — SWITCHYARD (rail depot, dusk) ============
const M2 = {
  id: 1, name: 'SWITCHYARD', target: 300,
  env: { sky: 0x2a2620, fog: [0x2a2620, 18, 95], ambient: 0x6a5f50, ambientI: 0.8, sunColor: 0xb08a50, sunI: 0.5 },
  playerStart: { pos: [0, 0.5, 62], yaw: 0 },
  geo() {
    const o = [];
    o.push(gbox(0, -0.5, 0, 150, 1, 160, 'gravel', { rep: [18, 20] }));
    o.push(gbox(-75.5, 4, 0, 1, 10, 160, 'brick')); o.push(gbox(75.5, 4, 0, 1, 10, 160, 'brick'));
    o.push(gbox(0, 4, 80.5, 150, 10, 1, 'brick')); o.push(gbox(0, 4, -80.5, 150, 10, 1, 'brick'));
    // rails (decor) + parked railcars as cover
    for (const rx of [-30, -10, 10, 30]) o.push(gbox(rx, 0.06, 0, 2.2, 0.12, 150, 'metal', { rep: [1, 30], nosolid: true }));
    const cars = [[-30, 30], [-30, -20], [-10, 45], [-10, -5], [10, 20], [30, 38], [30, -12], [10, -40]];
    for (const c of cars) o.push(gbox(c[0], 1.7, c[1], 3, 3.4, 12, 'train'));
    // 3 fuel tanks — left / far / right (route-choice puzzle)
    const tanks = [[-52, 18], [0, -58], [52, 2]];
    tanks.forEach((t, i) => {
      o.push(gbox(t[0], 2.5, t[1], 5, 5, 5, 'tank', { tag: 'tank' + i }));
      o.push(gbox(t[0], 0.4, t[1] + 4, 4, 0.8, 1.5, 'hazard', { nosolid: true }));
    });
    // signal tower (defend point) — center
    o.push(gbox(0, 2.5, 8, 6, 0.4, 6, 'metal'));         // platform
    o.push(gbox(-2.6, 1.15, 8, 0.8, 2.3, 0.8, 'metal')); o.push(gbox(2.6, 1.15, 8, 0.8, 2.3, 0.8, 'metal'));
    o.push(gbox(0, 1.25, 11.2, 4, 2.5, 0.7, 'metal'));   // stair block (jump up via crates)
    o.push(gbox(0, 0.6, 13.4, 3, 1.2, 1.8, 'crate'));
    o.push(gbox(0, 3.3, 5.2, 6, 1.2, 0.4, 'metal')); // railing, north edge of platform
    // depot shed west
    groomWalls(-52, -30, 18, 14, 5, 'brick', [{ side: 'e', off: 0, w: 3.5, h: 3 }], o);
    o.push(gbox(-52, 5.2, -30, 19, 0.4, 15, 'metal'));
    o.push(gbox(-54, 1, -32, 4, 2, 3, 'crate'));
    // arrival platform north — train boards here
    o.push(gbox(0, 0.6, -72, 60, 1.2, 6, 'concrete', { rep: [10, 1] }));
    o.push(gbox(20, 2.4, -76, 4, 3.6, 3, 'train', { tag: 'm2train' })); // engine appears on arrival
    // --- decor ---
    for (const z of [-40, 0, 40]) for (const x of [-38, 38]) { // catenary poles
      o.push(gbox(x, 3.5, z, 0.4, 7, 0.4, 'metal'));
      o.push(gbox(x + (x < 0 ? 3 : -3), 6.8, z, 6, 0.3, 0.3, 'metal', { nosolid: true }));
    }
    o.push(gbox(-14, 1.5, 30, 0.3, 3, 0.3, 'metal')); // signal mast
    o.push(gbox(-14, 3.1, 29.8, 0.25, 0.25, 0.12, 'metal', { basic: 0xc83020, nosolid: true }));
    o.push(gbox(-14, 2.7, 29.8, 0.25, 0.25, 0.12, 'metal', { basic: 0x40b840, nosolid: true }));
    o.push(gbox(22, 1.5, -28, 0.3, 3, 0.3, 'metal'));
    o.push(gbox(22, 3.1, -28.2, 0.25, 0.25, 0.12, 'metal', { basic: 0x40b840, nosolid: true }));
    o.push(gbox(-20, 0.5, 12, 3, 1, 1.6, 'crate')); o.push(gbox(38, 0.5, 28, 3, 1, 1.6, 'crate')); // sleeper stacks
    o.push(gbox(-30, 4, -66, 0.6, 8, 0.6, 'metal')); // floodlight tower at platform
    o.push(gbox(-30, 8.2, -65.5, 1.4, 0.5, 0.5, 'metal', { basic: 0xfff0c0, nosolid: true }));
    o.push(gbox(-56, 0.5, -33, 3, 1, 1.2, 'metal')); // depot desk
    o.push(gbox(-58.6, 1.5, -30, 0.3, 2, 4, 'panel')); // depot control panel
    barrels(-44, -26, o); barrels(40, 18, o);
    lamp(-10, 46, 5, o); lamp(24, -2, 5, o); lamp(-40, 4, 5, o);
    return o;
  },
  enemies: [
    { type: 'grunt', pos: [-8, 0, 40], patrol: [[-8, 0, 40], [8, 0, 40]] },
    { type: 'scout', pos: [8, 0, 48], patrol: [[8, 0, 48], [-6, 0, 52]] },
    { type: 'grunt', pos: [18, 0, 26], yaw: 0.6 },
    { type: 'scout', pos: [-24, 0, 30], yaw: 1.2 },
    { type: 'grunt', pos: [-40, 0, 20], yaw: 1.2 },
    { type: 'heavy', pos: [0, 0, -40], yaw: 0 },
    { type: 'grunt', pos: [44, 0, 6], yaw: -1.4 },
    { type: 'grunt', pos: [-52, 0, -24], yaw: 0 },
  ],
  objectives: [
    {
      type: 'multi', hold: 1.5, label: 'PLANTING CHARGE',
      points: [
        { pos: [-52, 2, 21.5], name: 'West tank' },
        { pos: [0, 2, -54.5], name: 'North tank' },
        { pos: [52, 2, 5.5], name: 'East tank' },
      ],
      text: 'Plant charges on 3 fuel tanks',
      onStart: { radio: [
        ['OVERWATCH', 'Switchyard, Ash. Their fuel reserve feeds the convoy line — three tanks, your order.'],
        ['OVERWATCH', 'Heavies on site. Watch the armor — they telegraph before the shotgun comes up.'],
      ] },
      onComplete: {
        explodeTags: ['tank0', 'tank1', 'tank2'],
        radio: [['OVERWATCH', 'That woke them up. Get to the signal tower and hold until the train rolls in!']],
        spawn: [
          { type: 'grunt', pos: [-20, 0, -60], yaw: 0 }, { type: 'grunt', pos: [20, 0, -60], yaw: 0 },
        ],
      },
      checkpoint: true,
    },
    {
      type: 'goto', pos: [0, 3, 8], r: 3.2, text: 'Get to the signal tower',
    },
    {
      type: 'defend', time: 60, pos: [0, 3, 8], r: 14,
      text: 'Hold the signal tower',
      waves: [
        { at: 55, spawn: [{ type: 'grunt', pos: [-30, 0, 45], }, { type: 'grunt', pos: [30, 0, 45] }] },
        { at: 42, spawn: [{ type: 'heavy', pos: [0, 0, 50] }, { type: 'scout', pos: [-45, 0, 10] }] },
        { at: 28, spawn: [{ type: 'grunt', pos: [45, 0, -20] }, { type: 'grunt', pos: [-45, 0, -20] }] },
        { at: 14, spawn: [{ type: 'heavy', pos: [20, 0, 45] }, { type: 'scout', pos: [-20, 0, 45] }] },
      ],
      onComplete: { radio: [['OVERWATCH', 'Train\'s braking at the north platform — board it NOW.']], moveTag: ['m2train', 0, 0, 0] },
      checkpoint: true,
    },
    {
      type: 'goto', pos: [20, 2, -74], r: 3.5, text: 'Board the train',
      onComplete: { radio: [['OVERWATCH', 'You\'re on. Storm front\'s rolling in — going to get loud up there.']] },
    },
  ],
};
