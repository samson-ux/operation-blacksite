// Pixel-soldier enemies: box-built humanoids with simple state AI.
const ENEMY_TYPES = {
  grunt:  { hp: 100, speed: 3.2, dmg: 7,  burst: 3, burstGap: 0.13, cooldown: [0.9, 1.6], acc: 0.75, range: 38, color: 0x4e5a40, scale: 1, seekCover: true },
  heavy:  { hp: 250, speed: 1.7, dmg: 11, burst: 1, burstGap: 0,    cooldown: [1.4, 2.0], acc: 0.65, range: 18, color: 0x57452e, scale: 1.18, seekCover: false },
  elite:  { hp: 150, speed: 4.2, dmg: 9,  burst: 4, burstGap: 0.1,  cooldown: [0.7, 1.2], acc: 0.92, range: 50, color: 0x565b5e, scale: 1, strafes: true, seekCover: true },
  scout:  { hp: 60,  speed: 5.6, dmg: 5,  burst: 5, burstGap: 0.08, cooldown: [0.5, 0.9], acc: 0.6,  range: 16, color: 0x6f7450, scale: 0.9, rush: true, telegraph: 0.3 },
  sniper: { hp: 90,  speed: 0.8, dmg: 34, burst: 1, burstGap: 0,    cooldown: [2.4, 3.2], acc: 0.95, range: 90, color: 0x47503a, scale: 1, stationary: true, telegraph: 0.9 },
  riot:   { hp: 180, speed: 2.2, dmg: 9,  burst: 2, burstGap: 0.2,  cooldown: [1.2, 1.8], acc: 0.7,  range: 14, color: 0x44484e, scale: 1.05, frontShield: true, telegraph: 0.5 },
  boss:   { hp: 600, speed: 2.6, dmg: 12, burst: 5, burstGap: 0.12, cooldown: [1.0, 1.5], acc: 0.85, range: 60, color: 0x3a2f2f, scale: 1.35, strafes: true, seekCover: false },
};
const TELEGRAPH = 0.4;

const Enemy = {
  build(type) {
    const cfg = ENEMY_TYPES[type], s = cfg.scale;
    const g = new THREE.Group();
    const bodyMat = Tex.flat(cfg.color);
    const skin = Tex.flat(0x8a7560);
    const B = (parent, mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); parent.add(m); return m;
    };
    const masked = type === 'elite' || type === 'boss' || type === 'sniper' || type === 'riot';
    const torsoW = type === 'scout' ? 0.4 : (type === 'heavy' ? 0.58 : 0.5);
    B(g, bodyMat, torsoW * s, 0.65 * s, 0.3 * s, 0, 1.05 * s, 0);
    B(g, masked ? Tex.flat(0x2a2d30) : skin, 0.26 * s, 0.26 * s, 0.26 * s, 0, 1.55 * s, 0);
    if (type === 'elite' || type === 'boss') {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.06 * s, 0.05 * s),
        new THREE.MeshBasicMaterial({ color: type === 'boss' ? 0xff3a20 : 0xff8c1a }));
      visor.position.set(0, 1.57 * s, -0.14 * s);
      g.add(visor);
    }
    if (type === 'scout') B(g, Tex.flat(0x3a3f2c), 0.3 * s, 0.07 * s, 0.32 * s, 0, 1.7 * s, -0.02 * s); // cap brim
    else B(g, bodyMat, 0.3 * s, 0.12 * s, 0.3 * s, 0, 1.69 * s, 0); // helmet
    if (type === 'heavy') { // shoulder pads
      B(g, Tex.flat(0x3c3422), 0.16 * s, 0.14 * s, 0.3 * s, -0.36 * s, 1.32 * s, 0);
      B(g, Tex.flat(0x3c3422), 0.16 * s, 0.14 * s, 0.3 * s, 0.36 * s, 1.32 * s, 0);
    }
    if (type === 'sniper') { // scope eye glint
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.04 * s),
        new THREE.MeshBasicMaterial({ color: 0x6fdcff }));
      lens.position.set(-0.05 * s, 1.58 * s, -0.14 * s);
      g.add(lens);
    }
    if (type === 'riot') { // frontal shield plate — the visual tell that he blocks from the front
      B(g, Tex.flat(0x363b42), 0.72 * s, 1.3 * s, 0.07 * s, 0, 0.95 * s, -0.26 * s);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.05 * s, 0.03 * s),
        new THREE.MeshBasicMaterial({ color: 0x101418 }));
      slit.position.set(0, 1.45 * s, -0.31 * s);
      g.add(slit);
    }
    const legL = B(g, Tex.flat(0x33392c), 0.16 * s, 0.72 * s, 0.18 * s, -0.13 * s, 0.36 * s, 0);
    const legR = B(g, Tex.flat(0x33392c), 0.16 * s, 0.72 * s, 0.18 * s, 0.13 * s, 0.36 * s, 0);
    const armGun = new THREE.Group();
    B(armGun, bodyMat, 0.12 * s, 0.12 * s, 0.5 * s, 0, 0, -0.25 * s);
    const gunLen = type === 'sniper' ? 0.85 : (type === 'scout' ? 0.3 : 0.45);
    B(armGun, Tex.flat(0x1d201a), 0.07 * s, 0.1 * s, gunLen * s, 0, 0, -(0.35 + gunLen / 2) * s);
    if (type === 'sniper') B(armGun, Tex.flat(0x14171a), 0.06 * s, 0.07 * s, 0.16 * s, 0, 0.08 * s, -0.6 * s); // scope
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0 }));
    muzzle.position.z = -(0.35 + gunLen + 0.05) * s;
    armGun.add(muzzle);
    armGun.position.set(0.3 * s, 1.25 * s, 0);
    g.add(armGun);
    if (type === 'boss') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), Tex.mat('objective', { emissive: 0x884400 }));
      pack.position.set(0, 1.1 * s, 0.3 * s);
      g.add(pack);
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x40c0ff, transparent: true, opacity: 0.18, depthWrite: false }));
      shield.position.y = 1.0 * s;
      g.add(shield);
      g.userData.pack = pack; g.userData.shield = shield;
    }
    // red outline: back-face shell behind every Lambert part (skips glows/visors/shield)
    if (!Enemy._outlineMat) Enemy._outlineMat = new THREE.MeshBasicMaterial({ color: 0xd42a1e, side: THREE.BackSide });
    const shells = [];
    g.traverse(m => { if (m.isMesh && m.material && m.material.isMeshLambertMaterial) shells.push(m); });
    for (const m of shells) {
      const o = new THREE.Mesh(m.geometry, Enemy._outlineMat);
      o.scale.setScalar(1.18);
      m.add(o); // child of the part — follows walk/telegraph animation
    }
    g.userData.armGun = armGun; g.userData.muzzle = muzzle;
    g.userData.legs = [legL, legR];
    return g;
  },

  spawn(def, scene) {
    const cfg = ENEMY_TYPES[def.type];
    const mesh = this.build(def.type);
    mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    scene.add(mesh);
    const e = {
      id: def.id || null, type: def.type, cfg, mesh,
      pos: mesh.position, yaw: def.yaw || 0,
      hp: def.hp || cfg.hp, alive: true,
      state: def.patrol ? 'patrol' : 'idle', stateT: 0,
      patrol: def.patrol || null, patrolIdx: 0, home: mesh.position.clone(),
      telegraphT: 0, burstLeft: 0, burstT: 0, cooldownT: U.rand(0.2, 0.8),
      strafeDir: Math.random() < 0.5 ? 1 : -1, strafeT: U.rand(1, 2),
      lastKnown: null, coverT: 0, walkT: Math.random() * 6,
      shielded: def.type === 'boss', def,
    };
    return e;
  },

  // weapon-fire hit test: returns {t, head, pack} or null
  hitTest(e, origin, dir, maxLen) {
    if (!e.alive) return null;
    const s = e.cfg.scale, p = e.pos;
    const mk = (cy, h, r) => ({ min: new THREE.Vector3(p.x - r, p.y + cy - h / 2, p.z - r), max: new THREE.Vector3(p.x + r, p.y + cy + h / 2, p.z + r) });
    const body = mk(0.725 * s, 1.45 * s, 0.34 * s); // stops at the neck so head shots aren't eaten
    const head = mk(1.62 * s, 0.34 * s, 0.2 * s);
    let result = null;
    if (e.type === 'boss') {
      // backpack hitbox (world-space, behind boss based on yaw)
      const bx = p.x + Math.sin(e.yaw) * 0.45, bz = p.z + Math.cos(e.yaw) * 0.45;
      const pk = { min: new THREE.Vector3(bx - 0.3, p.y + 1.1, bz - 0.3), max: new THREE.Vector3(bx + 0.3, p.y + 1.85, bz + 0.3) };
      const tp = World.segBox(origin, dir, maxLen, pk);
      if (tp >= 0) result = { t: tp, head: false, pack: true };
      if (e.shielded) {
        // shield blocks body/head; only the pack (physically exposed at the back) takes damage
        const tb = World.segBox(origin, dir, maxLen, body);
        if (tb >= 0 && (!result || tb < result.t - 0.5)) return { t: tb, head: false, pack: false, blocked: true };
        return result;
      }
    }
    const th = World.segBox(origin, dir, maxLen, head);
    if (th >= 0 && (!result || th < result.t)) result = { t: th, head: true, pack: false };
    const tb = World.segBox(origin, dir, maxLen, body);
    if (tb >= 0 && (!result || tb < result.t)) result = { t: tb, head: result ? result.head && th <= tb : false, pack: false };
    return result;
  },

  damage(e, amount, head) {
    if (!e.alive) return;
    e.hp -= amount;
    this.alertNear(e.pos, 18);
    if (e.state === 'idle' || e.state === 'patrol') { e.state = 'alert'; e.stateT = 0; }
    if (e.hp <= 0) this.kill(e);
  },

  kill(e) {
    e.alive = false;
    AudioSys.play('kill');
    Game.stats.kills++;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y += 0.2;
    setTimeout(() => { if (e.mesh.parent) e.mesh.parent.remove(e.mesh); }, 2500);
    Missions.onEnemyKilled(e);
  },

  alertNear(pos, radius) {
    for (const o of Game.enemies) {
      if (o.alive && (o.state === 'idle' || o.state === 'patrol') && o.pos.distanceTo(pos) < radius) {
        o.state = 'alert'; o.stateT = 0;
      }
    }
  },

  update(e, dt) {
    if (!e.alive) return;
    e.stateT += dt;
    const pp = Player.pos, eye = new THREE.Vector3(e.pos.x, e.pos.y + 1.5 * e.cfg.scale, e.pos.z);
    const pEye = Player.eyePos();
    const dist = e.pos.distanceTo(pp);
    const seeDist = e.cfg.range > 60 ? 95 : 55; // snipers spot you from far off
    const canSee = dist < seeDist && World.los(eye, pEye);

    const face = (tx, tz, rate) => {
      const want = Math.atan2(-(tx - e.pos.x), -(tz - e.pos.z));
      let d = want - e.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      e.yaw += U.clamp(d, -rate * dt, rate * dt);
      e.mesh.rotation.y = e.yaw;
    };
    const moveToward = (tx, tz, speed) => {
      const dx = tx - e.pos.x, dz = tz - e.pos.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.3) return true;
      const vel = new THREE.Vector3(dx / len * speed, e._vy || 0, dz / len * speed);
      vel.y = (e._vy || 0) - G.GRAVITY * dt;
      const before = e.pos.clone();
      const res = World.moveEntity(e.pos, vel, dt, 0.3, 1.7 * e.cfg.scale);
      e._vy = res.onGround ? 0 : vel.y;
      // stuck? nudge sideways
      if (e.pos.distanceTo(before) < speed * dt * 0.3) {
        const perp = new THREE.Vector3(-dz / len, 0, dx / len).multiplyScalar(speed * e.strafeDir);
        perp.y = e._vy;
        World.moveEntity(e.pos, perp, dt, 0.3, 1.7 * e.cfg.scale);
      }
      e.walkT += dt * speed * 2;
      return false;
    };
    // leg animation
    const moving = e.state === 'patrol' || e.state === 'attack' || e.state === 'cover';
    e.mesh.userData.legs[0].rotation.x = moving ? Math.sin(e.walkT) * 0.5 : 0;
    e.mesh.userData.legs[1].rotation.x = moving ? -Math.sin(e.walkT) * 0.5 : 0;

    switch (e.state) {
      case 'idle':
      case 'patrol':
        if (e.state === 'patrol' && e.patrol) {
          const t = e.patrol[e.patrolIdx];
          face(t[0], t[2], 3);
          if (moveToward(t[0], t[2], e.cfg.speed * 0.55)) e.patrolIdx = (e.patrolIdx + 1) % e.patrol.length;
        }
        if (canSee && dist < 30) {
          const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
          const toP = new THREE.Vector3(pp.x - e.pos.x, 0, pp.z - e.pos.z).normalize();
          if (fwd.dot(toP) > 0.2 || dist < 8) { e.state = 'alert'; e.stateT = 0; }
        }
        break;

      case 'alert':
        face(pp.x, pp.z, 6);
        if (e.stateT > 0.35) { e.state = 'attack'; e.stateT = 0; e.cooldownT = U.rand(0.1, 0.4); }
        break;

      case 'attack': {
        // boss turns slowly so slide-flanking can expose the backpack generator
        face(pp.x, pp.z, e.type === 'boss' ? 2.2 : 7);
        if (canSee) e.lastKnown = pp.clone();
        const arm = e.mesh.userData.armGun;

        const teleDur = e.cfg.telegraph || TELEGRAPH;
        if (e.telegraphT > 0) {
          // raise-weapon telegraph — visible wind-up before firing
          e.telegraphT -= dt;
          arm.rotation.x = U.lerp(-0.5, 0, e.telegraphT / teleDur);
          if (e.cfg.stationary) {
            // sniper aim laser: thin red line during the wind-up — your dodge window
            e.laserT = (e.laserT || 0) - dt;
            if (e.laserT <= 0) {
              e.laserT = 0.1;
              const mzl = new THREE.Vector3(e.pos.x, e.pos.y + 1.3 * e.cfg.scale, e.pos.z);
              FX.tracer(mzl, pEye.clone(), 0xff2020);
            }
          }
          if (e.telegraphT <= 0 && canSee) { e.burstLeft = e.cfg.burst; e.burstT = 0; }
        } else if (e.burstLeft > 0) {
          arm.rotation.x = -0.5;
          e.burstT -= dt;
          if (e.burstT <= 0) {
            e.burstLeft--;
            e.burstT = e.cfg.burstGap;
            this.fireAt(e, pEye, dist);
          }
          if (e.burstLeft <= 0) {
            e.cooldownT = U.rand(e.cfg.cooldown[0], e.cfg.cooldown[1]);
            if (e.cfg.seekCover && Math.random() < 0.35 && dist < 20) { e.state = 'cover'; e.stateT = 0; }
          }
        } else {
          arm.rotation.x = 0;
          e.cooldownT -= dt;
          if (canSee) {
            if (e.cooldownT <= 0 && dist < e.cfg.range) e.telegraphT = teleDur;
            // positioning
            if (e.cfg.stationary) {
              // sniper holds position
            } else if (e.cfg.rush && dist > 5) {
              moveToward(pp.x, pp.z, e.cfg.speed); // scout closes in
            } else if (e.cfg.strafes) {
              e.strafeT -= dt;
              if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = U.rand(0.8, 1.8); }
              const right = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
              moveToward(e.pos.x + right.x * e.strafeDir * 3, e.pos.z + right.z * e.strafeDir * 3, e.cfg.speed * 0.8);
            } else if (dist > e.cfg.range * 0.7) {
              moveToward(pp.x, pp.z, e.cfg.speed);
            }
          } else if (e.lastKnown) {
            if (moveToward(e.lastKnown.x, e.lastKnown.z, e.cfg.speed)) e.lastKnown = null;
          }
        }
        break;
      }

      case 'cover': {
        // back away from the player briefly
        const away = new THREE.Vector3(e.pos.x - pp.x, 0, e.pos.z - pp.z).normalize();
        moveToward(e.pos.x + away.x * 4, e.pos.z + away.z * 4, e.cfg.speed);
        face(pp.x, pp.z, 5);
        if (e.stateT > 1.2) { e.state = 'attack'; e.stateT = 0; }
        break;
      }
    }
    e.mesh.rotation.y = e.yaw;
  },

  fireAt(e, target, dist) {
    AudioSys.play('enemyShot');
    const mz = e.mesh.userData.muzzle;
    mz.material.opacity = 1;
    setTimeout(() => { mz.material.opacity = 0; }, 60);
    const origin = new THREE.Vector3(e.pos.x, e.pos.y + 1.3 * e.cfg.scale, e.pos.z);
    FX.tracer(origin, target.clone().add(new THREE.Vector3(U.rand(-1, 1), U.rand(-0.6, 0.6), U.rand(-1, 1))), 0xff6040);
    // accuracy falls with distance and player speed (rewards aggressive movement)
    const pSpeed = Math.hypot(Player.vel.x, Player.vel.z);
    const moveDodge = U.clamp(pSpeed / 14, 0, 0.45) + (Player.sliding ? 0.15 : 0);
    const hitChance = e.cfg.acc * U.clamp(1 - dist / (e.cfg.range * 1.6), 0.15, 1) * (1 - moveDodge);
    if (Math.random() < hitChance && World.los(origin, target)) {
      let dmg = e.cfg.dmg;
      if (e.type === 'heavy' && dist < 10) dmg = 22;
      Player.damage(dmg, e.pos);
    }
  },
};
