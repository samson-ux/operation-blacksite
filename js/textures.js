// Procedural canvas textures — desaturated military palette, chunky pixels.
const Tex = (() => {
  const cache = {};

  function make(size, fn) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    fn(g, size);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function noiseFill(g, s, base, vary, cell) {
    cell = cell || 4;
    for (let y = 0; y < s; y += cell)
      for (let x = 0; x < s; x += cell) {
        const v = (Math.random() - 0.5) * vary;
        g.fillStyle = `rgb(${base[0]+v|0},${base[1]+v|0},${base[2]+v|0})`;
        g.fillRect(x, y, cell, cell);
      }
  }
  const makers = {
    concrete: () => make(64, (g, s) => {
      noiseFill(g, s, [110, 112, 104], 26);
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let i = 0; i < 5; i++) g.fillRect(Math.random()*s, Math.random()*s, 2 + Math.random()*10, 2);
    }),
    metal: () => make(64, (g, s) => {
      noiseFill(g, s, [96, 100, 98], 14);
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 2);
      g.fillStyle = 'rgba(0,0,0,.3)';
      for (let y = 6; y < s; y += 8) g.fillRect(0, y, s, 1);
    }),
    crate: () => make(64, (g, s) => {
      noiseFill(g, s, [104, 92, 64], 20);
      g.strokeStyle = 'rgba(40,32,18,.8)'; g.lineWidth = 4;
      g.strokeRect(2, 2, s-4, s-4);
      g.beginPath(); g.moveTo(2, 2); g.lineTo(s-2, s-2); g.moveTo(s-2, 2); g.lineTo(2, s-2); g.stroke();
    }),
    container: () => make(64, (g, s) => {
      noiseFill(g, s, [78, 92, 70], 14);
      g.fillStyle = 'rgba(0,0,0,.35)';
      for (let x = 0; x < s; x += 10) g.fillRect(x, 0, 3, s);
      g.fillStyle = 'rgba(190,120,40,.35)';
      g.fillRect(8, 40, 26, 8);
    }),
    rust: () => make(64, (g, s) => {
      noiseFill(g, s, [96, 70, 52], 30, 3);
      g.fillStyle = 'rgba(140,70,30,.4)';
      for (let i = 0; i < 12; i++) { const r = 2+Math.random()*6; g.fillRect(Math.random()*s, Math.random()*s, r, r); }
    }),
    floor: () => make(64, (g, s) => {
      noiseFill(g, s, [72, 74, 66], 16);
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
    }),
    asphalt: () => make(64, (g, s) => {
      noiseFill(g, s, [56, 58, 54], 14, 3);
      g.fillStyle = 'rgba(220,200,60,.5)';
      g.fillRect(28, 0, 8, 22);
    }),
    gravel: () => make(64, (g, s) => { noiseFill(g, s, [88, 84, 74], 30, 3); }),
    brick: () => make(64, (g, s) => {
      noiseFill(g, s, [98, 78, 64], 16);
      g.fillStyle = 'rgba(30,24,18,.65)';
      for (let y = 0; y < s; y += 16) {
        g.fillRect(0, y, s, 2);
        const off = (y / 16) % 2 ? 16 : 0;
        for (let x = off; x < s; x += 32) g.fillRect(x, y, 2, 16);
      }
    }),
    bunker: () => make(64, (g, s) => {
      noiseFill(g, s, [82, 86, 82], 12);
      g.fillStyle = 'rgba(0,0,0,.3)';
      for (let y = 0; y < s; y += 16) g.fillRect(0, y, s, 3);
      g.fillStyle = 'rgba(200,140,40,.25)'; g.fillRect(4, 4, 12, 4);
    }),
    hazard: () => make(64, (g, s) => {
      g.fillStyle = '#a88018'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#1c1a14';
      for (let i = -s; i < s * 2; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 - s, s); g.lineTo(i - s, s); g.fill();
      }
    }),
    objective: () => make(32, (g, s) => {
      noiseFill(g, s, [255, 140, 26], 30, 4);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, s, 4); g.fillRect(0, s-4, s, 4);
    }),
    tank: () => make(64, (g, s) => {
      noiseFill(g, s, [120, 116, 108], 10);
      g.fillStyle = 'rgba(160,40,20,.7)'; g.fillRect(10, 24, 44, 16);
      g.fillStyle = '#ddd'; g.font = 'bold 12px monospace'; g.fillText('FUEL', 18, 36);
    }),
    train: () => make(64, (g, s) => {
      noiseFill(g, s, [70, 76, 84], 14);
      g.fillStyle = 'rgba(0,0,0,.4)';
      for (let x = 0; x < s; x += 12) g.fillRect(x, 0, 2, s);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 8, s, 4);
    }),
    water: () => make(64, (g, s) => {
      noiseFill(g, s, [22, 32, 38], 10, 4);
      g.fillStyle = 'rgba(120,140,150,.12)';
      for (let i = 0; i < 10; i++) g.fillRect(Math.random()*s, Math.random()*s, 8 + Math.random()*14, 1);
    }),
    rock: () => make(64, (g, s) => { noiseFill(g, s, [74, 70, 64], 24, 5); }),
  };

  function get(name) {
    if (!cache[name]) cache[name] = makers[name] ? makers[name]() : makers.concrete();
    return cache[name];
  }
  const matCache = {};
  function mat(name, opts) {
    const key = name + JSON.stringify(opts || {});
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ map: get(name) }, opts || {}));
    }
    return matCache[key];
  }
  function flat(color, opts) {
    const key = 'c' + color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
    return matCache[key];
  }
  return { get, mat, flat };
})();
