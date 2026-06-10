// FPS controller + weapons + viewmodel.
const WEAPONS = [
  { name: 'AR-7 RIFLE',  auto: true,  dmg: 24, mag: 30, reserve: 999, rpm: 660, reload: 1.7, spread: 0.012, pellets: 1, recoil: 0.011, sfx: 'rifle',  swap: 0.25, range: 120 },
  { name: 'M90 PUMP',    auto: false, dmg: 16, mag: 6,  reserve: 999, rpm: 70,  reload: 2.2, spread: 0.055, pellets: 8, recoil: 0.035, sfx: 'shotgun', swap: 0.35, range: 40 },
  { name: 'GHOST-9 SD',  auto: false, dmg: 17, mag: 12, reserve: Infinity, rpm: 420, reload: 1.1, spread: 0.008, pellets: 1, recoil: 0.006, sfx: 'pistol', swap: 0.18, range: 80 },
];

const Player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  hp: 100, alive: true,
  onGround: false, sliding: false, slideDir: new THREE.Vector3(),
  height: G.PLAYER_H,
  lastDamageTime: -99,
  weapon: 0, ammo: [], reloading: 0, fireCooldown: 0, swapCooldown: 0, pumpTime: 0,
  shake: 0, kick: 0,
  camera: null, viewmodel: null, vmParts: {},
  stepT: 0, lockMove: false, mountedGun: null,

  init(camera, scene) {
    this.camera = camera;
    // viewmodel gun (attached to camera)
    const vm = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), Tex.flat(0x2e3328));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.2), Tex.flat(0x1c1f18));
    barrel.position.set(0, 0.02, -0.3);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), Tex.flat(0x3a3528));
    grip.position.set(0, -0.09, 0.08);
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0 }));
    flash.position.set(0, 0.02, -0.44);
    vm.add(body, barrel, grip, flash);
    vm.position.set(0.22, -0.2, -0.45);
    camera.add(vm);
    this.viewmodel = vm;
    this.vmParts = { body, barrel, flash };
  },

  reset(pos, yaw, keepLoadout) {
    this.pos.copy(pos); this.vel.set(0, 0, 0);
    this.yaw = yaw || 0; this.pitch = 0;
    this.hp = 100; this.alive = true; this.sliding = false;
    this.height = G.PLAYER_H; this.lastDamageTime = -99;
    this.reloading = 0; this.fireCooldown = 0; this.swapCooldown = 0;
    this.lockMove = false; this.mountedGun = null;
    if (!keepLoadout) {
      this.weapon = 0;
      this.ammo = WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve === Infinity ? Infinity : w.mag * 4 }));
    }
  },

  snapshot() {
    return {
      pos: this.pos.toArray(), yaw: this.yaw, weapon: this.weapon,
      ammo: this.ammo.map(a => ({ mag: a.mag, reserve: a.reserve === Infinity ? 'inf' : a.reserve })),
    };
  },
  restore(s) {
    this.reset(new THREE.Vector3().fromArray(s.pos), s.yaw, true);
    this.weapon = s.weapon;
    this.ammo = s.ammo.map(a => ({ mag: a.mag, reserve: a.reserve === 'inf' ? Infinity : a.reserve }));
  },

  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.sliding ? G.EYE_SLIDE : G.EYE), this.pos.z); },
  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  },

  damage(amount, fromPos) {
    if (!this.alive || Game.state !== 'play') return;
    this.hp -= amount;
    this.lastDamageTime = Game.now;
    this.shake = Math.min(0.6, this.shake + 0.25);
    AudioSys.play('hurt');
    UI.damageFlash(fromPos, this);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; Game.onPlayerDeath(); }
  },

  swapTo(i) {
    if (i === this.weapon || i < 0 || i > 2) return;
    this.weapon = i;
    this.reloading = 0;            // reload cancel — core speedrun tech
    this.swapCooldown = WEAPONS[i].swap;
    this.pumpTime = 0;
    AudioSys.play('swap');
    UI.updateAmmo();
  },

  startReload() {
    const w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
    if (this.reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return;
    this.reloading = w.reload;
    AudioSys.play('reload');
  },

  fire() {
    const w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
    if (this.fireCooldown > 0 || this.swapCooldown > 0 || this.reloading > 0 || this.pumpTime > 0) return;
    if (a.mag <= 0) { AudioSys.play('dryfire'); this.fireCooldown = 0.3; this.startReload(); return; }
    a.mag--;
    this.fireCooldown = 60 / w.rpm;
    if (this.weapon === 1) this.pumpTime = 0.55;
    AudioSys.play(w.sfx);
    if (this.weapon === 1) setTimeout(() => AudioSys.play('pump'), 250);
    this.kick = w.recoil * 3;
    this.pitch += w.recoil * (0.7 + Math.random() * 0.6);
    this.yaw += w.recoil * (Math.random() - 0.5) * 0.8;
    this.vmParts.flash.material.opacity = 0.9;
    const origin = this.eyePos();
    for (let p = 0; p < w.pellets; p++) {
      const dir = this.forward();
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
      Game.stats.shots++;
      Game.hitscan(origin, dir, w.range, w.dmg, true);
    }
    UI.updateAmmo();
  },

  update(dt) {
    if (!this.alive) return;
    const sens = Settings.sens * 0.0011;
    const [dx, dy] = Input.consumeLook();
    this.yaw -= dx * sens;
    this.pitch = U.clamp(this.pitch - dy * sens, -1.45, 1.45);
    // uncaptured-cursor mode: holding the cursor at a screen edge keeps turning
    const [ex, ey] = Input.edgePush();
    if (ex || ey) {
      this.yaw -= ex * (1.6 + Settings.sens * 0.12) * dt;
      this.pitch = U.clamp(this.pitch - ey * 1.1 * dt, -1.45, 1.45);
    }

    // --- weapon input ---
    if (Input.pressed('Digit1')) this.swapTo(0);
    if (Input.pressed('Digit2')) this.swapTo(1);
    if (Input.pressed('Digit3')) this.swapTo(2);
    const wh = Input.consumeWheel();
    if (wh) this.swapTo((this.weapon + (wh > 0 ? 1 : 2)) % 3);
    if (Input.pressed('KeyR')) this.startReload();

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
        const need = w.mag - a.mag, take = Math.min(need, a.reserve);
        a.mag += take;
        if (a.reserve !== Infinity) a.reserve -= take;
        UI.updateAmmo();
      }
    }
    this.fireCooldown -= dt; this.swapCooldown -= dt; this.pumpTime -= dt;
    const w = WEAPONS[this.weapon];
    if (Input.mouse() && !this.lockMove && (w.auto || Input.pressed('Mouse0') || this.fireCooldown <= -0.5)) {
      if (w.auto || this._canSemi) { this.fire(); this._canSemi = false; }
    }
    if (!Input.mouse()) this._canSemi = true;

    // --- movement ---
    if (!this.lockMove) this.updateMovement(dt);

    // regen
    if (this.hp < 100 && Game.now - this.lastDamageTime > G.REGEN_DELAY) {
      this.hp = Math.min(100, this.hp + G.REGEN_RATE * dt);
    }

    // --- camera ---
    this.shake = Math.max(0, this.shake - dt * 2);
    this.kick = Math.max(0, this.kick - dt * 0.25);
    const sh = this.shake;
    this.camera.position.copy(this.eyePos());
    this.camera.position.x += (Math.random() - 0.5) * sh * 0.15;
    this.camera.position.y += (Math.random() - 0.5) * sh * 0.15;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // viewmodel bob + flash decay
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.stepT += dt * speed * 1.6;
    const bob = this.onGround ? Math.sin(this.stepT) * 0.008 * Math.min(1, speed / 4) : 0;
    this.viewmodel.position.set(0.22, -0.2 + bob + (this.sliding ? -0.06 : 0), -0.45 + this.kick);
    this.viewmodel.rotation.x = this.reloading > 0 ? 0.6 : (this.pumpTime > 0 ? 0.25 : 0);
    this.vmParts.flash.material.opacity *= 0.6;
  },

  updateMovement(dt) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (Input.down('KeyW')) mz += 1;
    if (Input.down('KeyS')) mz -= 1;
    if (Input.down('KeyD')) mx += 1;
    if (Input.down('KeyA')) mx -= 1;
    const wish = new THREE.Vector3().addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 0) wish.normalize();

    const sprinting = Input.down('ShiftLeft') || Input.down('ShiftRight');
    const speed = Math.hypot(this.vel.x, this.vel.z);

    // --- slide ---
    if (Input.pressed('KeyC') && sprinting && this.onGround && !this.sliding && speed > G.WALK) {
      this.sliding = true;
      this.height = G.PLAYER_H_SLIDE;
      this.slideDir.copy(wish.lengthSq() > 0 ? wish : fwd).normalize();
      const boost = Math.max(speed, G.SLIDE_BOOST);
      this.vel.x = this.slideDir.x * boost;
      this.vel.z = this.slideDir.z * boost;
      AudioSys.play('slide');
      UI.tutorialUsed('slide');
    }
    if (this.sliding) {
      if (!Input.down('KeyC') || speed < 3.5) {
        // stand up if room
        this.sliding = false; this.height = G.PLAYER_H;
      } else if (this.onGround) {
        // low friction — momentum preserved
        const f = 1 - G.SLIDE_FRICTION * dt;
        this.vel.x *= f; this.vel.z *= f;
        // slight steering
        this.vel.addScaledVector(right, mx * 6 * dt);
      }
    }

    if (!this.sliding) {
      const target = sprinting && mz > 0 ? G.SPRINT : G.WALK;
      if (this.onGround) {
        const accel = 40;
        this.vel.x = U.lerp(this.vel.x, wish.x * target, Math.min(1, accel * dt / 4));
        this.vel.z = U.lerp(this.vel.z, wish.z * target, Math.min(1, accel * dt / 4));
      } else {
        // air control: steer only — keeps slide-hop momentum but never adds speed beyond it
        const sp0 = Math.max(Math.hypot(this.vel.x, this.vel.z), G.WALK);
        this.vel.addScaledVector(wish, G.AIR_CONTROL * dt * 4);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        if (sp > sp0) { const k = sp0 / sp; this.vel.x *= k; this.vel.z *= k; }
      }
    }

    // jump — works during slide (slide-hop keeps full horizontal velocity)
    if (Input.pressed('Space') && this.onGround) {
      this.vel.y = G.JUMP_VEL;
      this.onGround = false;
      AudioSys.play('jump');
      UI.tutorialUsed('jump');
      if (this.sliding) { this.sliding = false; this.height = G.PLAYER_H; }
    }

    this.vel.y -= G.GRAVITY * dt;
    const res = World.moveEntity(this.pos, this.vel, dt, G.PLAYER_R, this.height);
    this.onGround = res.onGround;
    if (this.onGround && this.vel.y < 0) this.vel.y = 0;

    // footsteps
    if (this.onGround && speed > 2 && !this.sliding) {
      this._stepAcc = (this._stepAcc || 0) + speed * dt;
      if (this._stepAcc > 2.6) { this._stepAcc = 0; AudioSys.play('step'); }
    }
    // fell out of world
    if (this.pos.y < -30) this.damage(999, null);
  },
};
