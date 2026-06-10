// Game orchestration: renderer, state machine, loop, hitscan, mission flow, timer/splits/PBs.
const Game = {
  state: 'title',           // title | play | pause | dead | results | transition
  scene: null, camera: null, renderer: null,
  enemies: [], tagged: {},
  mission: 0, campaign: true,
  runTime: 0, timerStarted: false, missionStart: 0,
  splits: [null, null, null, null],
  stats: { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 },
  now: 0,

  init() {
    const canvas = document.getElementById('gamecanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(G.RENDER_W, G.RENDER_H, false); // low-res target, CSS upscales w/ pixelated
    this.camera = new THREE.PerspectiveCamera(Settings.fov, G.RENDER_W / G.RENDER_H, 0.1, 220);
    Player.init(this.camera, null);
    UI.init();
    this.camera.fov = Settings.fov; this.camera.updateProjectionMatrix();

    // letterbox the 16:9 pixel canvas inside any window shape
    const fit = () => {
      const a = G.RENDER_W / G.RENDER_H;
      let w = innerWidth, h = w / a;
      if (h > innerHeight) { h = innerHeight; w = h * a; }
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    fit();
    addEventListener('resize', fit);

    Input.onAnyInput(() => {
      if (this.state === 'play' && !this.timerStarted) this.timerStarted = true;
    });

    this.lockSupported = true;
    this.tryLock = () => {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { this.lockSupported = false; });
      } catch (e) { this.lockSupported = false; }
    };
    document.addEventListener('pointerlockchange', () => {
      // only auto-pause on losing a lock we actually had — never when lock is unavailable
      if (!document.pointerLockElement && this.state === 'play' && this._hadLock) this.pause();
      this._hadLock = !!document.pointerLockElement;
    });
    document.addEventListener('pointerlockerror', () => { this.lockSupported = false; });
    canvas.addEventListener('click', () => {
      if (this.state === 'play' && !document.pointerLockElement) this.tryLock();
      if (this.state === 'dead') this.respawn();
    });
    document.getElementById('deathmsg').addEventListener('click', () => {
      if (this.state === 'dead') this.respawn();
    });
    addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.state === 'play') this.pause();
    });

    let last = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const t = performance.now();
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.tick(dt);
    };
    loop();
  },

  // ---- mission flow ----
  startCampaign() {
    AudioSys.ensure();
    this.campaign = true;
    this.runTime = 0; this.timerStarted = false;
    this.splits = [null, null, null, null];
    this.stats = { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 };
    this.loadMission(0, false);
  },
  startLevel(i) {
    AudioSys.ensure();
    this.campaign = false;
    this.runTime = 0; this.timerStarted = false;
    this.stats = { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 };
    this.loadMission(i, false);
  },

  loadMission(i, fromCheckpoint) {
    this.mission = i;
    this.missionStart = this.runTime;
    if (this.scene) {
      this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
    this.enemies = [];
    FX.init(this.scene);
    buildLevel(LEVELS[i], this.scene);
    Missions.start(LEVELS[i], fromCheckpoint);
    UI.updateAmmo();
    UI.setObjective(Missions.objText());
    if (i === 0 && this.campaign && !fromCheckpoint) UI.tutorialStart();
    this.state = 'play';
    UI.show('hud');
    UI.fade(false);
    UI.showDeath(false);
    Input.consumeLook(); // discard look deltas accumulated in menus
    if (!document.pointerLockElement) this.tryLock();
    if (!fromCheckpoint) UI.flashSplit('MISSION ' + (i + 1) + ' — ' + LEVELS[i].name, '');
  },

  onMissionComplete() {
    const missionTime = this.runTime - this.missionStart;
    const d = Store.data;
    if (this.campaign) {
      this.splits[this.mission] = missionTime;
      const pbSplit = d.campaignPB && d.campaignPB.splits ? d.campaignPB.splits[this.mission] : null;
      const delta = pbSplit != null ? ` <span class="${missionTime <= pbSplit ? 'green' : 'red'}">${U.fmtDelta(missionTime - pbSplit)}</span>` : '';
      UI.flashSplit(`M${this.mission + 1} SPLIT — ${U.fmtTime(missionTime)}${delta}`, '');
      this.state = 'transition';
      UI.fade(true); // 1s max fade — speed-friendly
      setTimeout(() => {
        if (this.mission < 3) this.loadMission(this.mission + 1, false);
        else this.finishCampaign();
      }, 1000);
    } else {
      // IL run
      const pb = d.ilPB[this.mission];
      if (pb == null || missionTime < pb) { d.ilPB[this.mission] = missionTime; Store.save(); }
      this.state = 'results';
      document.exitPointerLock();
      const s = this.stats;
      UI.showResults(false, {
        total: missionTime, pb,
        deaths: s.deaths,
        acc: s.shots ? Math.round(100 * s.hits / s.shots) : 0,
        hs: s.hits ? Math.round(100 * s.headshots / s.hits) : 0,
      });
    }
  },

  rankFor(total) {
    return total < 1080 ? 'S' : total < 1260 ? 'A' : total < 1500 ? 'B' : total < 1800 ? 'C' : 'D';
  },

  finishCampaign() {
    const d = Store.data;
    const total = this.runTime;
    const pbTotal = d.campaignPB ? d.campaignPB.total : null;
    const pbSplits = d.campaignPB ? d.campaignPB.splits : null;
    if (pbTotal == null || total < pbTotal) {
      d.campaignPB = { total, splits: this.splits.slice() };
    }
    // IL PBs also credit from campaign splits
    this.splits.forEach((s, i) => {
      if (s != null && (d.ilPB[i] == null || s < d.ilPB[i])) d.ilPB[i] = s;
    });
    d.unlocked = true;
    Store.save();
    UI.refreshLocks();
    this.state = 'results';
    document.exitPointerLock();
    const s = this.stats;
    UI.showResults(true, {
      total, splits: this.splits, pbTotal, pbSplits,
      rank: this.rankFor(total),
      deaths: s.deaths,
      acc: s.shots ? Math.round(100 * s.hits / s.shots) : 0,
      hs: s.hits ? Math.round(100 * s.headshots / s.hits) : 0,
    });
  },

  // ---- death / respawn ----
  onPlayerDeath() {
    this.stats.deaths++;
    AudioSys.play('death');
    this.state = 'dead'; // timer keeps running — deaths cost time, not the run
    UI.showDeath(true);
  },
  respawn() {
    UI.showDeath(false);
    this.loadMission(this.mission, true);
  },

  // ---- pause ----
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; // timer stops (tick() only accumulates in play/dead)
    document.exitPointerLock();
    UI.show('pause');
  },
  resume() {
    this.state = 'play';
    UI.show('hud');
    Input.consumeLook(); // no view jump from cursor travel in the menu
    this.tryLock();
  },
  restartCheckpoint() {
    UI.show('hud');
    this.loadMission(this.mission, true);
  },
  quitToTitle() {
    this.state = 'title';
    document.exitPointerLock();
    UI.show('menu');
    UI.subtitle(null);
    UI.interact(null);
    UI.defendTimer(null);
  },

  // ---- combat ----
  addEnemy(def) {
    const e = Enemy.spawn(def, this.scene);
    this.enemies.push(e);
    return e;
  },

  hitscan(origin, dir, range, dmg, fromPlayer) {
    const wHit = World.raycast(origin, dir, range);
    const wT = wHit ? wHit.t : range;
    let best = null, bestE = null;
    for (const e of this.enemies) {
      const h = Enemy.hitTest(e, origin, dir, Math.min(wT, range));
      if (h && (!best || h.t < best.t)) { best = h; bestE = e; }
    }
    let endPoint;
    if (best && best.t < wT) {
      endPoint = origin.clone().addScaledVector(dir, best.t);
      if (best.blocked) {
        AudioSys.play('bossShield'); // shield spark — no damage
      } else if (best.pack) {
        Missions.bossPackHit(dmg);
        this.stats.hits++;
        UI.hitmarker(false);
      } else {
        const finalDmg = best.head ? dmg * G.HEADSHOT_MULT : dmg;
        Enemy.damage(bestE, finalDmg, best.head);
        this.stats.hits++;
        if (best.head) { this.stats.headshots++; AudioSys.play('headshot'); }
        else AudioSys.play('hit');
        UI.hitmarker(best.head);
      }
    } else {
      endPoint = wHit ? wHit.point : origin.clone().addScaledVector(dir, range);
      if (wHit) FX.impact(endPoint);
    }
    // tracer from just below the eye (gun-ish) to the end point
    const right = new THREE.Vector3(Math.cos(Player.yaw), 0, -Math.sin(Player.yaw));
    const muzzle = origin.clone().addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.12, 0));
    FX.tracer(muzzle, endPoint);
  },

  // ---- main loop ----
  tick(dt) {
    if (this.state === 'play' || this.state === 'dead' || this.state === 'transition') {
      if (this.timerStarted && this.state !== 'transition') this.runTime += dt;
      this.now += dt;
    }

    if (this.state === 'play') {
      // tutorial usage tracking
      if (UI.tut) {
        if (Input.down('KeyW') || Input.down('KeyA') || Input.down('KeyS') || Input.down('KeyD')) UI.tutorialUsed('move');
        if (Input.down('ShiftLeft')) UI.tutorialUsed('sprint');
        if (Input.mouse()) UI.tutorialUsed('shoot');
      }
      Player.update(dt);
      Missions.update(dt);
      // enemy AI (budget: skip far enemies)
      for (const e of this.enemies) {
        if (e.alive && e.pos.distanceTo(Player.pos) < 75) Enemy.update(e, dt);
      }
      FX.update(dt);
    } else if (this.state === 'dead' || this.state === 'transition') {
      FX.update(dt);
    }

    if (this.scene) {
      UI.update(dt, this.camera);
      this.renderer.render(this.scene, this.camera);
    }
  },
};

addEventListener('DOMContentLoaded', () => Game.init());
