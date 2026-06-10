// Objective script engine: goto / interact / multi / defend / boss / escape,
// radio queue, checkpoints, mounted gun, boss phases.
const Missions = {
  level: null, objIdx: 0, obj: null,
  interactT: 0, interactStarted: false, multiDone: {}, multiT: 0, multiAt: -1,
  defendT: 0, wavesFired: {}, escapeT: 0,
  boss: null, bossPackHp: 0, bossPhase: 0,
  removedTags: [], radioQ: [], radioT: 0,
  checkpoint: null, mgMounted: false, mgCool: 0,
  complete: false, alarmT: 0,

  start(levelDef, fromCheckpoint) {
    this.level = levelDef;
    this.radioQ = []; this.radioT = 0;
    this.mgMounted = false; this.complete = false;
    this.boss = null; this.bossPhase = 0;

    if (fromCheckpoint) {
      const cp = this.checkpoint;
      this.objIdx = cp.objIdx;
      this.removedTags = cp.removedTags.slice();
      this.multiDone = Object.assign({}, cp.multiDone);
      for (const t of this.removedTags) this.applyRemoveTag(t);
      for (const ed of cp.enemies) Game.addEnemy(ed);
      Player.restore(cp.player);
      this.initObjective(true);
    } else {
      this.objIdx = 0;
      this.removedTags = [];
      this.multiDone = {};
      for (const ed of levelDef.enemies) Game.addEnemy(ed);
      const ps = levelDef.playerStart;
      Player.reset(new THREE.Vector3(ps.pos[0], ps.pos[1], ps.pos[2]), ps.yaw);
      this.initObjective(false);
      this.saveCheckpoint(); // mission start is always a checkpoint
    }
  },

  initObjective(silent) {
    this.obj = this.level.objectives[this.objIdx] || null;
    this.interactT = 0; this.interactStarted = false;
    this.multiT = 0; this.multiAt = -1;
    this.defendT = this.obj && this.obj.type === 'defend' ? this.obj.time : 0;
    this.escapeT = this.obj && this.obj.type === 'escape' ? this.obj.time : 0;
    this.wavesFired = {};
    if (!this.obj) return;
    UI.setObjective(this.objText());
    AudioSys.play('ping');
    const st = this.obj.onStart;
    if (st && !silent) {
      if (st.radio) for (const r of st.radio) this.radioQ.push(r);
      if (st.spawn && !st.spawnAt) for (const ed of st.spawn) Game.addEnemy(ed);
    } else if (st && silent) {
      // on checkpoint restore still spawn objective enemies (they're part of the encounter)
      if (st.spawn && !st.spawnAt) for (const ed of st.spawn) Game.addEnemy(ed);
    }
    if (this.obj.type === 'boss') this.spawnBoss();
    if (this.obj.type === 'escape') { this.alarmT = 0; }
  },

  objText() {
    const o = this.obj;
    if (!o) return '';
    if (o.type === 'multi') {
      const left = o.points.filter((p, i) => !this.multiDone[i]).length;
      return `${o.text} (${o.points.length - left}/${o.points.length})`;
    }
    return o.text;
  },

  markerPos() {
    const o = this.obj;
    if (!o) return null;
    if (o.type === 'multi') {
      let best = null, bd = 1e9;
      o.points.forEach((p, i) => {
        if (this.multiDone[i]) return;
        const v = new THREE.Vector3(p.pos[0], p.pos[1] + 1.5, p.pos[2]);
        const d = v.distanceTo(Player.pos);
        if (d < bd) { bd = d; best = v; }
      });
      return best;
    }
    if (o.type === 'boss') return this.boss && this.boss.alive ? this.boss.pos.clone().add(new THREE.Vector3(0, 2, 0)) : null;
    if (o.type === 'defend') return null;
    return new THREE.Vector3(o.pos[0], o.pos[1] + 1, o.pos[2]);
  },

  saveCheckpoint() {
    this.checkpoint = {
      objIdx: this.objIdx,
      player: Player.snapshot(),
      removedTags: this.removedTags.slice(),
      multiDone: Object.assign({}, this.multiDone),
      enemies: Game.enemies.filter(e => e.alive && e.type !== 'boss')
        .map(e => ({ type: e.type, pos: [e.pos.x, e.pos.y, e.pos.z], yaw: e.yaw, patrol: e.patrol })),
    };
  },

  applyRemoveTag(tag) {
    const items = Game.tagged[tag];
    if (!items) return;
    for (const it of items) {
      if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
      if (it.box) World.remove(it.box);
    }
  },

  runActions(a) {
    if (!a) return;
    if (a.removeTag) { this.removedTags.push(a.removeTag); this.applyRemoveTag(a.removeTag); }
    if (a.explodeAt) for (const p of a.explodeAt) FX.explosion(new THREE.Vector3(p[0], p[1], p[2]), true);
    if (a.explodeTags) for (const t of a.explodeTags) {
      const items = Game.tagged[t];
      if (items) for (const it of items) FX.explosion(it.mesh.position.clone(), true);
      this.removedTags.push(t); this.applyRemoveTag(t);
    }
    if (a.spawn) for (const ed of a.spawn) Game.addEnemy(ed);
    if (a.radio) for (const r of a.radio) this.radioQ.push(r);
    if (a.alarm) AudioSys.play('alarm');
    if (a.heli) AudioSys.play('heli');
  },

  completeObjective() {
    const o = this.obj;
    AudioSys.play('objDone');
    this.runActions(o.onComplete);
    this.objIdx++;
    if (this.objIdx >= this.level.objectives.length) {
      this.complete = true;
      this.obj = null;
      UI.setObjective('');
      Game.onMissionComplete();
      return;
    }
    this.initObjective(false);
    if (o.checkpoint) { this.saveCheckpoint(); AudioSys.play('checkpoint'); UI.flashSplit('CHECKPOINT', ''); }
  },

  // ---- boss ----
  spawnBoss() {
    const o = this.obj;
    this.boss = Game.addEnemy(o.bossSpawn);
    this.bossPackHp = 120;
    this.bossPhase = 0;
    this.boss.shielded = true;
  },
  bossPackHit(dmg) {
    const b = this.boss;
    if (!b || !b.alive) return;
    if (b.shielded) {
      this.bossPackHp -= dmg;
      AudioSys.play('hit');
      if (this.bossPackHp <= 0) {
        b.shielded = false;
        if (b.mesh.userData.shield) b.mesh.userData.shield.visible = false;
        AudioSys.play('shieldDown');
        UI.flashSplit('SHIELD DOWN', '');
      }
    } else {
      Enemy.damage(b, dmg, false);
    }
  },
  onEnemyKilled(e) {
    if (e === this.boss && this.obj && this.obj.type === 'boss') this.completeObjective();
  },
  bossUpdate() {
    const b = this.boss, o = this.obj;
    if (!b || !b.alive) return;
    const thresholds = [400, 200];
    if (this.bossPhase < thresholds.length && b.hp <= thresholds[this.bossPhase] && !b.shielded) {
      // re-shield, spawn adds
      this.bossPhase++;
      b.shielded = true;
      this.bossPackHp = 120;
      if (b.mesh.userData.shield) b.mesh.userData.shield.visible = true;
      AudioSys.play('bossShield');
      UI.flashSplit('SHIELD RESTORED — ADDS INBOUND', '');
      const adds = o.adds[this.bossPhase - 1] || [];
      for (const ed of adds) Game.addEnemy(ed);
    }
  },

  // ---- per-frame ----
  update(dt) {
    // radio queue
    if (this.radioQ.length > 0) {
      if (this.radioT <= 0) {
        const [who, line] = this.radioQ[0];
        UI.subtitle(who, line);
        AudioSys.play('radioOn');
        this.radioT = Math.max(2.2, line.length * 0.05);
      }
      this.radioT -= dt;
      if (Input.pressed('KeyF')) this.radioT = 0;
      if (this.radioT <= 0) {
        this.radioQ.shift();
        if (this.radioQ.length === 0) { UI.subtitle(null); AudioSys.play('radioOff'); }
      }
    }

    const o = this.obj;
    if (!o || this.complete) return;
    const pp = Player.pos;

    // mounted gun (M3)
    this.updateMG(dt);

    switch (o.type) {
      case 'goto': {
        const d = Math.hypot(pp.x - o.pos[0], pp.z - o.pos[2]);
        const dy = Math.abs((pp.y) - o.pos[1]);
        if (d < o.r && dy < 3) this.completeObjective();
        break;
      }
      case 'interact': {
        const d = Math.hypot(pp.x - o.pos[0], pp.z - o.pos[2]);
        const near = d < o.r && Math.abs(pp.y - o.pos[1]) < 3;
        if (near && Input.down('KeyE')) {
          if (!this.interactStarted) {
            this.interactStarted = true;
            const st = o.onStart;
            if (st && st.spawn && st.spawnAt) for (const ed of st.spawn) Game.addEnemy(ed);
          }
          this.interactT += dt;
          UI.interact(o.label, this.interactT / o.hold);
          if (this.interactT >= o.hold) { UI.interact(null); this.completeObjective(); }
        } else {
          UI.interact(near ? o.label + ' [HOLD E]' : null, this.interactT / o.hold);
          if (!near) UI.interact(null);
        }
        if (near) UI.prompt('HOLD [E]'); else UI.prompt('');
        break;
      }
      case 'multi': {
        let nearIdx = -1;
        o.points.forEach((p, i) => {
          if (this.multiDone[i]) return;
          const d = Math.hypot(pp.x - p.pos[0], pp.z - p.pos[2]);
          if (d < 3 && Math.abs(pp.y - p.pos[1]) < 3.5) nearIdx = i;
        });
        if (nearIdx >= 0 && Input.down('KeyE')) {
          if (this.multiAt !== nearIdx) { this.multiAt = nearIdx; this.multiT = 0; }
          this.multiT += dt;
          UI.interact(o.label + ' — ' + o.points[nearIdx].name, this.multiT / o.hold);
          if (this.multiT >= o.hold) {
            this.multiDone[nearIdx] = true;
            this.multiT = 0; this.multiAt = -1;
            UI.interact(null);
            AudioSys.play('objDone');
            UI.setObjective(this.objText());
            const left = o.points.filter((p, i) => !this.multiDone[i]).length;
            if (left === 0) this.completeObjective();
            else this.saveCheckpoint(); // partial progress is checkpointed
          }
        } else {
          UI.interact(null);
          UI.prompt(nearIdx >= 0 ? 'HOLD [E]' : '');
        }
        break;
      }
      case 'defend': {
        this.defendT -= dt;
        UI.defendTimer(this.defendT);
        for (let wi = 0; wi < (o.waves || []).length; wi++) {
          const w = o.waves[wi];
          if (!this.wavesFired[wi] && this.defendT <= w.at) {
            this.wavesFired[wi] = true;
            for (const ed of w.spawn) Game.addEnemy(ed);
          }
        }
        if (this.defendT <= 0) { UI.defendTimer(null); this.completeObjective(); }
        break;
      }
      case 'boss': {
        this.bossUpdate();
        break;
      }
      case 'escape': {
        this.escapeT -= dt;
        UI.defendTimer(this.escapeT);
        this.alarmT -= dt;
        if (this.alarmT <= 0) { AudioSys.play('alarm'); this.alarmT = 2.4; Player.shake = Math.min(0.5, Player.shake + 0.08); }
        if (this.escapeT <= 0) {
          UI.defendTimer(null);
          Player.damage(999, null); // collapse caught you — back to checkpoint, timer keeps running
          this.escapeT = o.time;
        }
        const d = Math.hypot(pp.x - o.pos[0], pp.z - o.pos[2]);
        if (d < o.r && Math.abs(pp.y - o.pos[1]) < 4) { UI.defendTimer(null); this.completeObjective(); }
        break;
      }
    }
  },

  updateMG(dt) {
    const mg = this.level.mg;
    if (!mg) return;
    const d = Math.hypot(Player.pos.x - mg.pos[0], Player.pos.z - mg.pos[2]);
    this.mgCool -= dt;
    if (!this.mgMounted) {
      if (d < 2.5 && Math.abs(Player.pos.y + 1 - mg.pos[1]) < 3) {
        UI.prompt('[E] MOUNT GUN');
        if (Input.pressed('KeyE')) {
          this.mgMounted = true;
          Player.lockMove = true;
          Player.pos.set(mg.pos[0], mg.pos[1] - 1.2, mg.pos[2]);
          Player.vel.set(0, 0, 0);
        }
      }
    } else {
      UI.prompt('[E] DISMOUNT');
      if (Input.pressed('KeyE')) { this.mgMounted = false; Player.lockMove = false; UI.prompt(''); }
      if (Input.mouse() && this.mgCool <= 0) {
        this.mgCool = 0.07;
        AudioSys.play('rifle');
        const dir = Player.forward();
        dir.x += (Math.random() - 0.5) * 0.03; dir.y += (Math.random() - 0.5) * 0.03;
        dir.normalize();
        Game.stats.shots++;
        Game.hitscan(Player.eyePos(), dir, 100, 30, true);
        Player.kick = 0.04;
      }
    }
  },
};
