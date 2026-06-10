// Missions 3 & 4.

// ============ MISSION 3 — BLACK RAIN (moving train, storm) ============
// The train "moves" via storm rain, fog, and wind audio; the level is the train itself:
// a long line of cars heading -z, gaps between cars (fall = death plane at y<-30 handled by player).
const M3 = {
  id: 2, name: 'BLACK RAIN', target: 360,
  env: { sky: 0x0c0f14, fog: [0x0c0f14, 8, 55], ambient: 0x3e4854, ambientI: 0.9, sunColor: 0x60707f, sunI: 0.3, rain: true },
  playerStart: { pos: [0, 2.2, 96], yaw: 0 },
  geo() {
    const o = [];
    // ground far below (death if you fall between cars... actually land & die-ish: keep a kill plane feel)
    o.push(gbox(0, -12, 0, 60, 1, 280, 'gravel', { rep: [8, 40], nosolid: true }));
    // car helper: flatbed or boxcar at z center
    const flat = (z, len) => { o.push(gbox(0, 1.5, z, 6, 1.0, len, 'train', { rep: [1, 4] })); };
    const boxcar = (z, len) => {
      flat(z, len);
      groomWalls(0, z, 6, len, 3.2, 'train', [
        { side: 'n', off: 0, w: 2.2, h: 2.6 }, { side: 's', off: 0, w: 2.2, h: 2.6 },
      ], o, 2); // walls sit on the bed (top of bed = y 2)
      o.push(gbox(0, 5.4, z, 6.4, 0.4, len, 'metal'));   // roof
    };
    // rear caboose (start) → engine at front
    flat(96, 14);                                  // start flatbed
    boxcar(78, 16);                                // car 1
    flat(60, 14);                                  // flatbed w/ crates
    o.push(gbox(-1.5, 2.6, 62, 2, 1.2, 2, 'crate')); o.push(gbox(1.5, 2.6, 57, 2, 1.2, 2, 'crate'));
    o.push(gbox(1.5, 3.8, 57, 1.8, 1.2, 1.8, 'crate')); // stacked — springboard to the boxcar roofs
    boxcar(42, 16);                                // car 2
    flat(24, 14);                                  // MOUNTED GUN flatbed
    o.push(gbox(0, 2.5, 27, 1.2, 1.0, 1.2, 'metal', { tag: 'mgmount' }));
    o.push(gbox(-2, 2.6, 20, 1.8, 1.2, 1.8, 'crate'));
    boxcar(6, 16);                                 // car 3
    flat(-12, 14);
    o.push(gbox(2, 2.6, -10, 1.8, 1.2, 1.8, 'crate')); o.push(gbox(-2, 2.6, -15, 1.8, 1.2, 1.8, 'crate'));
    boxcar(-30, 16);                               // car 4
    // coupler plates bridge every car gap — the middle lane is continuously walkable,
    // the outer edges over the gaps still drop you
    for (const z of [87.5, 68.5, 51.5, 32.5, 15.5, -3.5, -20.5, -39.5])
      o.push(gbox(0, 1.5, z, 3, 1.0, 4.2, 'metal'));
    // engine
    o.push(gbox(0, 1.5, -52, 6, 1.0, 22, 'train'));
    groomWalls(0, -54, 6, 16, 3.6, 'metal', [{ side: 's', off: 0, w: 2.2, h: 2.8 }], o, 2);
    o.push(gbox(0, 5.6, -54, 6.6, 0.5, 17, 'metal'));
    o.push(gbox(0, 2.7, -58, 2.5, 1.4, 1.5, 'objective', { glow: true })); // engine console
    // --- decor ---
    o.push(gbox(-2.2, 2.4, 80, 1.2, 0.8, 3, 'crate')); // boxcar benches
    o.push(gbox(2.2, 2.4, 40, 1.2, 0.8, 3, 'crate'));
    o.push(gbox(-2.2, 2.4, -32, 1.2, 0.8, 3, 'crate'));
    o.push(gbox(-1.8, 3.3, 64, 2.4, 2.6, 5, 'container')); // half-width container, lane stays open
    o.push(gbox(0, 6.2, 78, 0.12, 1.4, 0.12, 'metal', { nosolid: true })); // roof antennas
    o.push(gbox(0.8, 6.1, 6, 0.12, 1.2, 0.12, 'metal', { nosolid: true }));
    for (const z of [89.2, 70.8, 67.2, 49.2, 31.2, 17.2, -4.8, -22.8]) // hazard stripes at car ends
      o.push(gbox(0, 2.06, z, 6, 0.05, 0.45, 'hazard', { nosolid: true }));
    o.push(gbox(0, 7, -59, 1, 2.6, 1, 'metal', { cyl: true, nosolid: true })); // smokestack
    o.push(gbox(0, 3.5, -62.8, 0.6, 0.6, 0.2, 'metal', { basic: 0xfff2c0, nosolid: true })); // headlight
    return o;
  },
  enemies: [
    { type: 'grunt', pos: [1.5, 2, 80], yaw: 3.1 },
    { type: 'grunt', pos: [-1.5, 2, 74], yaw: 3.1 },
    { type: 'elite', pos: [0, 2, 60], yaw: 3.1 },
    { type: 'scout', pos: [1.5, 2, 50], yaw: 3.1 },
    { type: 'grunt', pos: [1.5, 2, 44], yaw: 3.1 },
    { type: 'heavy', pos: [0, 2, 38], yaw: 3.1 },
    { type: 'scout', pos: [-1.5, 2, 16], yaw: 3.1 },
    { type: 'elite', pos: [-1.5, 2, 8], yaw: 3.1 },
    { type: 'grunt', pos: [1.5, 2, 2], yaw: 3.1 },
    { type: 'sniper', pos: [0, 5.6, -30], yaw: 3.1 }, // boxcar roof — watch for the laser
    { type: 'elite', pos: [0, 2, -14], yaw: 3.1 },
    { type: 'heavy', pos: [0, 2, -28], yaw: 3.1 },
    { type: 'riot', pos: [0, 2, -44], yaw: 3.1 },     // guards the engine door
  ],
  mg: { pos: [0, 2.8, 27], yaw: Math.PI }, // mounted gun, faces rear — covers the push from car 3 spawns; skippable
  objectives: [
    {
      type: 'goto', pos: [0, 2.5, 24], r: 4, text: 'Fight forward along the train',
      onStart: { radio: [
        ['OVERWATCH', 'You\'re on BLACKSITE\'s train. Push to the engine — k-zzkt — Ash, my signal\'s degrading.'],
        ['ASH', 'Say again, Overwatch? You\'re breaking up.'],
      ] },
      onComplete: { spawn: [
        { type: 'grunt', pos: [-1.5, 2, 40], yaw: 0 }, { type: 'scout', pos: [1.5, 2, 44], yaw: 0 },
        { type: 'elite', pos: [0, 2, 36], yaw: 0 },
      ], radio: [['OVERWATCH', 'zzzkt — behind y— zzkt — mounted gun on the flatbed if you need it.']] },
      checkpoint: true,
    },
    {
      type: 'goto', pos: [0, 2.5, -44], r: 3.5, text: 'Reach the engine',
      checkpoint: true,
    },
    {
      type: 'interact', pos: [0, 2.5, -58], r: 3, hold: 4, label: 'ACCESSING NAV COMPUTER',
      text: 'Access the engine console [hold E]',
      onComplete: { radio: [
        ['ASH', 'Overwatch, nav says this train was re-routed... by an agency keycode. OUR keycode.'],
        ['UNKNOWN', 'kzzzt — She knows. Cut her loop. — kzzzt'],
        ['ASH', 'Someone inside sold us out. Fine. I\'ll finish this myself.'],
      ] },
    },
  ],
};

// ============ MISSION 4 — VAULT (mountain bunker, boss, timed escape) ============
const M4 = {
  id: 3, name: 'VAULT', target: 420,
  env: { sky: 0x101210, fog: [0x101210, 14, 80], ambient: 0x4c5448, ambientI: 0.85, sunColor: 0x707868, sunI: 0.3 },
  playerStart: { pos: [0, 24.5, 86], yaw: 0 },
  geo() {
    const o = [];
    // Three rings descend: ring1 y=24, ring2 y=12, ring3 y=0, vault/arena y=0 far north. Ramps connect.
    const ring = (cy, cz, w, d, tex, doors) => {
      o.push(gbox(0, cy - 0.5, cz, w, 1, d, tex, { rep: [Math.round(w / 8), Math.round(d / 8)] }));
      groomWalls(0, cz, w, d, 7, 'bunker', doors, o, cy);
    };
    // RING 1 — entry hall y=24 (stair doors are tall so jumps up the steps clear the lintel)
    ring(24, 74, 36, 32, 'floor', [{ side: 'n', off: 8, w: 4, h: 4.5 }]);
    o.push(gbox(-8, 25, 70, 4, 2, 4, 'crate')); o.push(gbox(6, 25, 78, 3, 2, 3, 'crate'));
    // ramp 1: z 58→44, y 24→12 — 1 m risers, climbable both ways
    for (let i = 0; i <= 10; i++) o.push(gbox(8, 23 - i - 0.5, 57.5 - i * 1.3, 6, 1, 2, 'concrete'));
    // RING 2 — y=12
    ring(12, 28, 44, 34, 'floor', [{ side: 's', off: 8, w: 4, h: 4.5 }, { side: 'n', off: -10, w: 4, h: 4.5 }]);
    o.push(gbox(-12, 13.2, 30, 5, 2.4, 5, 'crate')); o.push(gbox(10, 13.2, 22, 4, 2.4, 4, 'crate'));
    o.push(gbox(0, 13.2, 34, 3, 2.4, 3, 'metal'));
    // ramp 2: z 11 → -3, y 12→0 — 1 m risers
    for (let i = 0; i <= 10; i++) o.push(gbox(-10, 11 - i - 0.5, 9.5 - i * 1.3, 6, 1, 2, 'concrete'));
    // RING 3 — security hub y=0 with switch rooms east & west
    ring(0, -22, 52, 36, 'floor', [
      { side: 's', off: -10, w: 4, h: 4.5 },
      { side: 'e', off: 0, w: 3.5, h: 3 }, { side: 'w', off: 0, w: 3.5, h: 3 },
      { side: 'n', off: 0, w: 6, h: 4 },
    ]);
    o.push(gbox(-8, 1.2, -18, 4, 2.4, 4, 'crate')); o.push(gbox(12, 1.2, -28, 5, 2.4, 4, 'metal'));
    // switch room EAST
    o.push(gbox(33, -0.5, -22, 14, 1, 14, 'floor', { rep: [2, 2] }));
    groomWalls(33, -22, 14, 14, 6, 'bunker', [{ side: 'w', off: 0, w: 3.5, h: 3 }], o);
    o.push(gbox(37, 1.2, -22, 1.5, 2.4, 1.5, 'objective', { glow: true, tag: 'switchE' }));
    // switch room WEST
    o.push(gbox(-33, -0.5, -22, 14, 1, 14, 'floor', { rep: [2, 2] }));
    groomWalls(-33, -22, 14, 14, 6, 'bunker', [{ side: 'e', off: 0, w: 3.5, h: 3 }], o);
    o.push(gbox(-37, 1.2, -22, 1.5, 2.4, 1.5, 'objective', { glow: true, tag: 'switchW' }));
    // vault door (north of ring 3) — removed when power cut
    o.push(gbox(0, 2, -40, 6, 4, 1, 'hazard', { tag: 'vaultdoor' }));
    // ARENA — boss room y=0, z -46..-86
    o.push(gbox(0, -0.5, -64, 44, 1, 44, 'metal', { rep: [6, 6] }));
    groomWalls(0, -64, 44, 44, 10, 'bunker', [{ side: 's', off: 0, w: 6, h: 4 }], o);
    o.push(gbox(-12, 1.5, -58, 5, 3, 5, 'metal')); o.push(gbox(12, 1.5, -70, 5, 3, 5, 'metal'));
    o.push(gbox(0, 1.5, -76, 6, 3, 4, 'metal'));
    o.push(gbox(0, 1, -80, 2, 2, 2, 'objective', { glow: true, tag: 'blacksite' })); // the package
    // helipad back at top (escape target)
    o.push(gbox(0, 23.5, 92, 14, 1, 10, 'helipad'));
    // --- decor ---
    o.push(gbox(-25.6, 5.5, -22, 0.5, 0.5, 30, 'rust', { nosolid: true })); // hub wall pipes
    o.push(gbox(25.6, 5.5, -22, 0.5, 0.5, 30, 'rust', { nosolid: true }));
    o.push(gbox(0, 17.5, 28, 43, 0.4, 0.4, 'rust', { nosolid: true }));     // ring2 pipe run
    o.push(gbox(-16, 14.5, 24, 1.2, 5, 1.2, 'concrete')); // ring2 pillars (cover)
    o.push(gbox(16, 14.5, 34, 1.2, 5, 1.2, 'concrete'));
    o.push(gbox(-18, 2.5, -14, 1.4, 5, 1.4, 'concrete')); // hub pillars
    o.push(gbox(18, 2.5, -30, 1.4, 5, 1.4, 'concrete'));
    o.push(gbox(33, 1.5, -27.6, 6, 3, 0.8, 'panel'));   // server racks, switch rooms
    o.push(gbox(-33, 1.5, -27.6, 6, 3, 0.8, 'panel'));
    o.push(gbox(33, 1.5, -16.4, 6, 3, 0.8, 'panel'));
    o.push(gbox(-33, 1.5, -16.4, 6, 3, 0.8, 'panel'));
    // wall lights: warm in rings, red along the escape line
    for (const L of [[-17.5, 29, 74], [17.5, 29, 74], [-21.5, 17, 28], [21.5, 17, 28], [-25.5, 5, -22], [25.5, 5, -22]])
      o.push(gbox(L[0], L[1], L[2], 0.5, 0.3, 0.5, 'metal', { basic: 0xffe2a8, nosolid: true }));
    for (const L of [[11.2, 25, 52], [5, 14.8, 9.5], [-6.8, 13, 9], [-13.2, 2.8, -3]])
      o.push(gbox(L[0], L[1], L[2], 0.3, 0.3, 0.3, 'metal', { basic: 0xc82818, nosolid: true }));
    o.push(gbox(0, 1.2, -64, 2.6, 2.4, 2.6, 'panel')); // arena center console block
    return o;
  },
  enemies: [
    { type: 'grunt', pos: [-6, 24, 66], yaw: 3.1 }, { type: 'grunt', pos: [8, 24, 70], yaw: 3.1 },
    { type: 'elite', pos: [0, 24, 62], yaw: 3.1 },
    { type: 'grunt', pos: [-10, 12, 26], yaw: 3.1 }, { type: 'heavy', pos: [0, 12, 20], yaw: 3.1 },
    { type: 'elite', pos: [14, 12, 30], yaw: 3.1 },
    { type: 'sniper', pos: [-16, 12, 15], yaw: 3.1 }, { type: 'sniper', pos: [16, 12, 14], yaw: 3.1 },
    { type: 'grunt', pos: [-12, 0, -14], yaw: 0 }, { type: 'grunt', pos: [12, 0, -16], yaw: 0 },
    { type: 'riot', pos: [6, 0, -28], yaw: 0 }, { type: 'riot', pos: [-6, 0, -28], yaw: 0 },
    { type: 'elite', pos: [0, 0, -30], yaw: 0 },
    { type: 'heavy', pos: [33, 0, -26], yaw: 0 }, { type: 'elite', pos: [-33, 0, -26], yaw: 0 },
  ],
  objectives: [
    {
      type: 'goto', pos: [0, 0.5, -22], r: 6, text: 'Descend to the security hub',
      onStart: { radio: [
        ['ASH', 'VULKAN\'s bunker. No Overwatch this time. Just me and whatever\'s in that vault.'],
      ] },
      checkpoint: true,
    },
    {
      type: 'multi', hold: 2, label: 'CUTTING POWER',
      points: [
        { pos: [37, 1.5, -22], name: 'East breaker' },
        { pos: [-37, 1.5, -22], name: 'West breaker' },
      ],
      text: 'Cut vault power — two switch rooms, either order',
      onComplete: {
        removeTag: 'vaultdoor', explodeAt: [[0, 2, -40]],
        radio: [['ASH', 'Vault\'s open. Whoever\'s in there — knock knock.']],
      },
      checkpoint: true,
    },
    {
      type: 'boss', text: 'Eliminate Commander Roth',
      bossSpawn: { type: 'boss', pos: [0, 0, -72], yaw: 0 },
      adds: [
        [{ type: 'grunt', pos: [-16, 0, -50] }, { type: 'grunt', pos: [16, 0, -50] }, { type: 'scout', pos: [0, 0, -48] }],
        [{ type: 'elite', pos: [-16, 0, -50] }, { type: 'elite', pos: [16, 0, -50] }, { type: 'scout', pos: [0, 0, -48] }],
      ],
      onStart: { radio: [
        ['ROTH', 'Sergeant Calloway. Your own agency priced you at four million. I\'d have paid ten.'],
        ['ASH', 'Shield generator\'s on his back. Noted.'],
      ] },
      onComplete: { radio: [['ASH', 'Commander\'s down. Taking the package.']] },
      checkpoint: true,
    },
    {
      type: 'interact', pos: [0, 1.2, -80], r: 2.6, hold: 2, label: 'SECURING BLACKSITE',
      text: 'Grab the BLACKSITE package [hold E]',
      onComplete: {
        removeTag: 'blacksite',
        radio: [['ASH', 'Package secure — and the building knows it. RUN.']],
        alarm: true,
      },
      checkpoint: true,
    },
    {
      type: 'escape', time: 90, pos: [0, 24.5, 92], r: 5,
      text: 'ESCAPE — get to the helipad',
      onStart: { spawn: [
        { type: 'grunt', pos: [-8, 0, -20], yaw: 0 }, { type: 'scout', pos: [8, 0, -20], yaw: 0 },
        { type: 'elite', pos: [-10, 12, 26], yaw: 0 }, { type: 'scout', pos: [10, 12, 30], yaw: 0 },
        { type: 'grunt', pos: [0, 24, 70], yaw: 0 },
      ] },
      onComplete: { radio: [
        ['PILOT', 'Package and operative aboard. Dust-off!'],
        ['UNKNOWN', 'kzzzt — Calloway. You have something of ours. We\'ll be in touch. — kzzzt'],
      ], heli: true },
    },
  ],
};

const LEVELS = [M1, M2, M3, M4];
