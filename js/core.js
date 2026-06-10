// Constants, input, AABB collision world, raycast helpers.
const G = {
  RENDER_W: 320, RENDER_H: 180,
  GRAVITY: 22,
  WALK: 5.2, SPRINT: 8.0, SLIDE_BOOST: 11.5, SLIDE_FRICTION: 0.35,
  AIR_CONTROL: 3.2, JUMP_VEL: 7.6,
  EYE: 1.62, EYE_SLIDE: 0.85, PLAYER_R: 0.38, PLAYER_H: 1.78, PLAYER_H_SLIDE: 0.9,
  REGEN_DELAY: 4, REGEN_RATE: 40,
  HEADSHOT_MULT: 2,
};

const Input = (() => {
  const keys = {}, once = {};
  let mouseDown = false, mouseDX = 0, mouseDY = 0, wheel = 0;
  let anyInputCb = null;

  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true; once[e.code] = true;
    if (anyInputCb) { anyInputCb(); }
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousedown', e => { if (e.button === 0) { mouseDown = true; once.Mouse0 = true; if (anyInputCb) anyInputCb(); } });
  addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
  let lastX = null, lastY = null, curX = null, curY = null;
  addEventListener('mousemove', e => {
    if (document.pointerLockElement) {
      mouseDX += e.movementX; mouseDY += e.movementY;
      lastX = lastY = null;
    } else {
      // fallback look: pointer lock unavailable (embedded previews, some trackpads) —
      // aim follows the raw cursor instead. Per-event delta capped so window re-entry
      // or focus jumps can't whip the view around.
      if (lastX != null) {
        mouseDX += U.clamp(e.clientX - lastX, -80, 80);
        mouseDY += U.clamp(e.clientY - lastY, -80, 80);
      }
      lastX = e.clientX; lastY = e.clientY;
    }
    curX = e.clientX; curY = e.clientY;
  });
  document.addEventListener('mouseleave', () => { lastX = lastY = null; curX = curY = null; });
  addEventListener('blur', () => { lastX = lastY = null; curX = curY = null; });
  addEventListener('wheel', e => { wheel += Math.sign(e.deltaY); }, { passive: true });

  return {
    down: c => !!keys[c],
    pressed: c => { const v = !!once[c]; once[c] = false; return v; },
    mouse: () => mouseDown,
    consumeLook() { const r = [mouseDX, mouseDY]; mouseDX = mouseDY = 0; return r; },
    // continuous turn when the uncaptured cursor sits near a screen edge (-1..1 per axis)
    edgePush() {
      if (document.pointerLockElement || curX == null) return [0, 0];
      const mx = innerWidth * 0.06, my = innerHeight * 0.08;
      let x = 0, y = 0;
      if (curX < mx) x = -(1 - curX / mx);
      else if (curX > innerWidth - mx) x = 1 - (innerWidth - curX) / mx;
      if (curY < my) y = -(1 - curY / my);
      else if (curY > innerHeight - my) y = 1 - (innerHeight - curY) / my;
      return [x, y];
    },
    locked: () => !!document.pointerLockElement,
    consumeWheel() { const w = wheel; wheel = 0; return w; },
    clear() { for (const k in keys) keys[k] = false; for (const k in once) once[k] = false; mouseDown = false; },
    onAnyInput(cb) { anyInputCb = cb; },
  };
})();

// ---- Collision world: list of static AABBs ----
const World = {
  boxes: [],   // {min:Vector3, max:Vector3, mesh?, tag?}
  clear() { this.boxes.length = 0; },
  addBox(cx, cy, cz, sx, sy, sz, tag) {
    const b = {
      min: new THREE.Vector3(cx - sx/2, cy - sy/2, cz - sz/2),
      max: new THREE.Vector3(cx + sx/2, cy + sy/2, cz + sz/2),
      tag: tag || null, solid: true,
    };
    this.boxes.push(b);
    return b;
  },
  remove(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); },

  // Move an AABB entity (pos = feet center) with per-axis resolution. Returns {onGround}
  moveEntity(pos, vel, dt, radius, height) {
    let onGround = false;
    const tryAxis = (axis, delta) => {
      pos[axis] += delta;
      const eMin = new THREE.Vector3(pos.x - radius, pos.y, pos.z - radius);
      const eMax = new THREE.Vector3(pos.x + radius, pos.y + height, pos.z + radius);
      for (const b of this.boxes) {
        if (!b.solid) continue;
        if (eMin.x < b.max.x && eMax.x > b.min.x &&
            eMin.y < b.max.y && eMax.y > b.min.y &&
            eMin.z < b.max.z && eMax.z > b.min.z) {
          if (axis === 'y') {
            if (delta < 0) { pos.y = b.max.y; onGround = true; }
            else pos.y = b.min.y - height;
            vel.y = 0;
          } else if (axis === 'x') {
            pos.x = delta > 0 ? b.min.x - radius - 0.001 : b.max.x + radius + 0.001;
            vel.x = 0;
          } else {
            pos.z = delta > 0 ? b.min.z - radius - 0.001 : b.max.z + radius + 0.001;
            vel.z = 0;
          }
          eMin.set(pos.x - radius, pos.y, pos.z - radius);
          eMax.set(pos.x + radius, pos.y + height, pos.z + radius);
        }
      }
    };
    tryAxis('x', vel.x * dt);
    tryAxis('z', vel.z * dt);
    tryAxis('y', vel.y * dt);
    return { onGround };
  },

  // Segment vs single AABB; returns t in [0,1] or -1 (slab method)
  segBox(o, d, len, b) {
    let tmin = 0, tmax = len;
    for (const ax of ['x', 'y', 'z']) {
      const dir = d[ax];
      if (Math.abs(dir) < 1e-9) {
        if (o[ax] < b.min[ax] || o[ax] > b.max[ax]) return -1;
      } else {
        let t1 = (b.min[ax] - o[ax]) / dir, t2 = (b.max[ax] - o[ax]) / dir;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
    }
    return tmin;
  },

  // Raycast against static world. origin Vector3, dir normalized Vector3.
  raycast(origin, dir, maxLen) {
    let best = -1, hitBox = null;
    for (const b of this.boxes) {
      if (!b.solid) continue;
      const t = this.segBox(origin, dir, maxLen, b);
      if (t >= 0 && (best < 0 || t < best)) { best = t; hitBox = b; }
    }
    return best >= 0 ? { t: best, box: hitBox, point: origin.clone().addScaledVector(dir, best) } : null;
  },

  // Line of sight between two points (true if clear)
  los(a, bPt) {
    const d = bPt.clone().sub(a); const len = d.length();
    if (len < 0.01) return true;
    d.normalize();
    const hit = this.raycast(a, d, len - 0.05);
    return !hit;
  },
};

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  fmtTime(s) {
    const m = Math.floor(s / 60), sec = s - m * 60;
    return `${String(m).padStart(2, '0')}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
  },
  fmtDelta(d) {
    const sign = d <= 0 ? '-' : '+';
    return sign + U.fmtTime(Math.abs(d));
  },
  rand: (a, b) => a + Math.random() * (b - a),
};
