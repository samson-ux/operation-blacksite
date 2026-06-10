// HUD, menus, timer/splits/PBs, results, settings.
const Store = {
  KEY: 'blacksite_v1',
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch (e) { this.data = {}; }
    this.data.settings = Object.assign({ sens: 8, fov: 90, vol: 70 }, this.data.settings || {});
    this.data.ilPB = this.data.ilPB || [null, null, null, null];
    return this.data;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
};
const Settings = { sens: 8, fov: 90, vol: 70 };

const UI = {
  el: {}, tut: null, tutShown: '',
  splitTimer: 0, hitT: 0, dmgT: 0,

  init() {
    const ids = ['hud', 'menu', 'pause', 'results', 'timer', 'objtext', 'objmarker', 'ammo', 'healthbar',
      'healthfill', 'vignette', 'dmgdir', 'hitmarker', 'interactbar', 'subtitles', 'prompt', 'splitflash',
      'defendtimer', 'fade', 'deathmsg', 'compassstrip', 'ranknote', 'lockhint'];
    for (const id of ids) this.el[id] = document.getElementById(id);

    const d = Store.load();
    Object.assign(Settings, d.settings);

    // settings sliders
    const bind = (id, key, fmt) => {
      const inp = document.getElementById('set-' + id), out = document.getElementById('out-' + id);
      inp.value = Settings[key];
      out.textContent = fmt(Settings[key]);
      inp.oninput = () => {
        Settings[key] = +inp.value;
        out.textContent = fmt(Settings[key]);
        d.settings[key] = Settings[key];
        Store.save();
        if (key === 'vol') AudioSys.setVolume(Settings.vol / 100);
        if (key === 'fov' && Game.camera) { Game.camera.fov = Settings.fov; Game.camera.updateProjectionMatrix(); }
      };
    };
    bind('sens', 'sens', v => v);
    bind('fov', 'fov', v => v + '°');
    bind('vol', 'vol', v => v + '%');
    AudioSys.setVolume(Settings.vol / 100);

    // menu buttons
    const panels = ['levels', 'times', 'controls', 'settings'];
    const togglePanel = name => {
      for (const p of panels) document.getElementById('panel-' + p).classList.toggle('show', p === name && !document.getElementById('panel-' + p).classList.contains('show'));
    };
    document.getElementById('btn-new').onclick = () => { AudioSys.play('click'); Game.startCampaign(); };
    document.getElementById('btn-levels').onclick = () => { AudioSys.play('click'); this.buildLevelSelect(); togglePanel('levels'); };
    document.getElementById('btn-times').onclick = () => { AudioSys.play('click'); this.buildBestTimes(); togglePanel('times'); };
    document.getElementById('btn-controls').onclick = () => { AudioSys.play('click'); togglePanel('controls'); };
    document.getElementById('btn-settings').onclick = () => { AudioSys.play('click'); togglePanel('settings'); };
    document.getElementById('btn-resume').onclick = () => Game.resume();
    document.getElementById('btn-restart-cp').onclick = () => Game.restartCheckpoint();
    document.getElementById('btn-quit').onclick = () => Game.quitToTitle();
    document.getElementById('btn-res-menu').onclick = () => Game.quitToTitle();

    this.refreshLocks();
  },

  refreshLocks() {
    const unlocked = !!Store.data.unlocked;
    document.getElementById('btn-levels').classList.toggle('locked', !unlocked);
  },

  buildLevelSelect() {
    const p = document.getElementById('panel-levels');
    let html = '<h2>LEVEL SELECT — IL PRACTICE</h2>';
    LEVELS.forEach((L, i) => {
      const pb = Store.data.ilPB[i];
      html += `<button class="btn" style="width:340px" onclick="Game.startLevel(${i})">M${i + 1} — ${L.name}` +
        `<span style="float:right;color:var(--org)">${pb != null ? U.fmtTime(pb) : '--:--'}</span></button>`;
    });
    p.innerHTML = html;
  },

  buildBestTimes() {
    const p = document.getElementById('panel-times');
    const d = Store.data;
    let html = '<h2>BEST TIMES</h2>';
    if (d.campaignPB) {
      html += `<table><tr><th>FULL CAMPAIGN</th><th>${U.fmtTime(d.campaignPB.total)}</th><th>RANK ${Game.rankFor(d.campaignPB.total)}</th></tr>`;
      d.campaignPB.splits.forEach((s, i) => {
        html += `<tr><td>M${i + 1} ${LEVELS[i].name}</td><td>${s != null ? U.fmtTime(s) : '--'}</td><td></td></tr>`;
      });
      html += '</table>';
    } else html += '<p style="color:var(--gry)">No campaign completed yet.</p>';
    html += '<h2 style="margin-top:14px">INDIVIDUAL LEVELS</h2><table>';
    LEVELS.forEach((L, i) => {
      const pb = d.ilPB[i];
      html += `<tr><td>M${i + 1} ${L.name}</td><td>${pb != null ? U.fmtTime(pb) : '--:--'}</td></tr>`;
    });
    html += '</table>';
    p.innerHTML = html;
  },

  show(name) {
    for (const n of ['menu', 'pause', 'results', 'hud']) this.el[n].classList.toggle('show', n === name);
  },

  // ---- HUD ----
  setObjective(t) { this.el.objtext.textContent = t || ''; },
  prompt(t) { if (this._promptLock) return; this.el.prompt.textContent = t || ''; },

  subtitle(who, line) {
    this.el.subtitles.innerHTML = who ? `<span class="who">${who}:</span> ${line} <span style="color:#666;font-size:10px">[F]</span>` : '';
  },

  interact(label, frac) {
    const ib = this.el.interactbar;
    if (!label) { ib.style.display = 'none'; return; }
    ib.style.display = 'block';
    ib.querySelector('.lbl').textContent = label;
    ib.querySelector('.fill').style.width = U.clamp((frac || 0) * 100, 0, 100) + '%';
  },

  defendTimer(t) {
    const el = this.el.defendtimer;
    if (t == null) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = '0:' + String(Math.max(0, Math.ceil(t))).padStart(2, '0');
  },

  hitmarker(head) {
    const h = this.el.hitmarker;
    h.classList.toggle('head', !!head);
    h.style.opacity = 1;
    this.hitT = 0.18;
  },

  damageFlash(fromPos, player) {
    this.dmgT = 0.7;
    if (fromPos) {
      const dx = fromPos.x - player.pos.x, dz = fromPos.z - player.pos.z;
      const ang = Math.atan2(dx, -dz) + player.yaw;
      this.el.dmgdir.style.transform = `rotate(${ang}rad)`;
      this.el.dmgdir.style.opacity = 1;
    }
  },

  updateAmmo() {
    const w = WEAPONS[Player.weapon], a = Player.ammo[Player.weapon];
    this.el.ammo.querySelector('.wname').textContent = w.name;
    this.el.ammo.querySelector('.mag').textContent = a.mag;
    this.el.ammo.querySelector('.res').textContent = a.reserve === Infinity ? ' / ∞' : ' / ' + a.reserve;
  },

  flashSplit(line1, line2) {
    const el = this.el.splitflash;
    el.innerHTML = line1 + (line2 ? '<br>' + line2 : '');
    el.style.display = 'block';
    this.splitTimer = 3;
  },

  // tutorial hints (Mission 1 only) — fade after first use
  tutorialStart() { this.tut = { move: false, sprint: false, slide: false, jump: false, shoot: false }; },
  tutorialUsed(k) { if (this.tut && k in this.tut) this.tut[k] = true; },
  tutorialText() {
    if (!this.tut) return '';
    const hints = [];
    if (!this.tut.move) hints.push('[WASD] MOVE');
    if (!this.tut.sprint) hints.push('[SHIFT] SPRINT');
    if (!this.tut.slide) hints.push('[C] SLIDE WHILE SPRINTING');
    if (!this.tut.jump) hints.push('[SPACE] JUMP');
    if (!this.tut.shoot) hints.push('[CLICK] FIRE');
    if (hints.length === 0) { this.tut = null; return ''; }
    return hints.slice(0, 2).join('   ');
  },

  update(dt, camera) {
    // run timer
    this.el.timer.textContent = U.fmtTime(Game.runTime);
    this.el.timer.classList.toggle('dim', !Game.timerStarted);

    // cursor-aim hint when pointer lock isn't active
    this.el.lockhint.style.display = (Game.state === 'play' && !Input.locked()) ? 'block' : 'none';

    // health
    const hp = Player.hp;
    this.el.healthbar.style.opacity = hp < 99 ? 1 : 0;
    this.el.healthfill.style.width = hp + '%';
    this.el.vignette.style.opacity = hp < 70 ? (1 - hp / 70) * 0.95 : 0;

    // hitmarker / damage dir decay
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.style.opacity = 0; }
    if (this.dmgT > 0) { this.dmgT -= dt; if (this.dmgT <= 0) this.el.dmgdir.style.opacity = 0; }
    if (this.splitTimer > 0) { this.splitTimer -= dt; if (this.splitTimer <= 0) this.el.splitflash.style.display = 'none'; }

    // tutorial hints
    if (this.tut) {
      const t = this.tutorialText();
      if (t) { this.el.prompt.textContent = t; this._promptLock = false; }
    }

    // compass
    let deg = (-Player.yaw * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    if (!this._compassBuilt) {
      let s = '';
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: '·', 135: '·', 225: '·', 315: '·' };
      for (let rep = 0; rep < 3; rep++)
        for (let a = 0; a < 360; a += 45) s += `<span style="position:absolute;left:${(rep * 360 + a) * 1.2}px;width:20px;text-align:center">${names[a]}</span>`;
      this.el.compassstrip.innerHTML = s;
      this._compassBuilt = true;
    }
    this.el.compassstrip.style.left = (130 - (deg + 360) * 1.2 - 10) + 'px';

    // objective world marker
    const mp = Missions.markerPos();
    const mk = this.el.objmarker;
    if (mp && camera) {
      const v = mp.clone().project(camera);
      if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) {
        const rc = document.getElementById('gamecanvas').getBoundingClientRect();
        mk.style.display = 'block';
        mk.style.left = (rc.left + (v.x * 0.5 + 0.5) * rc.width) + 'px';
        mk.style.top = (rc.top + (-v.y * 0.5 + 0.5) * rc.height) + 'px';
        mk.querySelector('span').textContent = Math.round(mp.distanceTo(Player.pos)) + 'm';
      } else mk.style.display = 'none';
    } else mk.style.display = 'none';
  },

  fade(on, snap) {
    this.el.fade.classList.toggle('snap', !!snap);
    this.el.fade.style.opacity = on ? 1 : 0;
  },

  showDeath(on) { this.el.deathmsg.style.display = on ? 'flex' : 'none'; },

  // ---- results ----
  showResults(campaign, data) {
    document.getElementById('res-title').textContent = campaign ? 'OPERATION COMPLETE' : 'MISSION COMPLETE';
    this.el.ranknote.textContent = campaign ? 'RANK ' + data.rank : U.fmtTime(data.total);
    const b = document.getElementById('res-body');
    let html = '<table>';
    if (campaign) {
      html += `<tr><th>TOTAL TIME</th><th>${U.fmtTime(data.total)}</th><th>${data.pbTotal ? 'PB ' + U.fmtTime(data.pbTotal) : 'FIRST CLEAR'}</th></tr>`;
      data.splits.forEach((s, i) => {
        const pb = data.pbSplits ? data.pbSplits[i] : null;
        const delta = pb != null && s != null ? `<span class="${s <= pb ? 'green' : 'red'}">${U.fmtDelta(s - pb)}</span>` : '';
        html += `<tr><td>M${i + 1} ${LEVELS[i].name}</td><td>${s != null ? U.fmtTime(s) : '--'}</td><td>${delta}</td></tr>`;
      });
    } else {
      const pb = data.pb;
      html += `<tr><td>TIME</td><td>${U.fmtTime(data.total)}</td><td>${pb ? (data.total <= pb ? '<span class="green">NEW PB</span>' : 'PB ' + U.fmtTime(pb)) : '<span class="green">FIRST CLEAR</span>'}</td></tr>`;
    }
    html += `<tr><td>DEATHS</td><td>${data.deaths}</td><td></td></tr>`;
    html += `<tr><td>ACCURACY</td><td>${data.acc}%</td><td></td></tr>`;
    html += `<tr><td>HEADSHOT %</td><td>${data.hs}%</td><td></td></tr>`;
    html += '</table>';
    if (campaign) html += `<p style="margin-top:10px;color:var(--gry);font-size:12px">S &lt; 18:00 · A &lt; 21:00 · B &lt; 25:00 · C &lt; 30:00</p>`;
    b.innerHTML = html;
    this.show('results');
  },
};
