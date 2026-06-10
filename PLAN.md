# OPERATION BLACKSITE — Build Plan

## Tech approach
- Three.js **r128 UMD** from cdnjs (global `THREE`, plain `<script>` tags, no modules) so the game runs by double-clicking `index.html` in Chrome. No build step, no server required.
- Renderer sized to **320×180** internally, canvas CSS-stretched to fullscreen with `image-rendering: pixelated`.
- All textures generated on 2D canvas (NearestFilter). All SFX synthesized with WebAudio.
- UI is HTML/CSS overlays (menus, HUD, subtitles, results) — cheap, crisp, and easy to keep non-blocking.

## File structure
```
operation-blacksite/
  index.html        entry point: CSS, DOM overlays, script tags
  js/audio.js       WebAudio SFX synth (shoot, reload, hit, headshot, explosion, ping, radio, etc.)
  js/textures.js    procedural canvas textures + material cache (military palette)
  js/core.js        constants, input manager, AABB collision world, raycast helpers
  js/player.js      FPS controller (WASD/sprint/jump/crouch-slide), weapons, viewmodel
  js/enemy.js       enemy factory (Grunt/Heavy/Elite/Boss), state AI, telegraphs
  js/levels.js      data-driven level builder + Mission 1 & 2 definitions
  js/levels2.js     Mission 3 & 4 definitions (train, bunker, boss arena, escape)
  js/missions.js    objective script engine, triggers, checkpoints, defend/escape timers
  js/ui.js          HUD, menus, run timer, splits, PB storage, results/rank screen
  js/main.js        game state machine, loop, mission loading, death/respawn
  README.md / DECISIONS.md / SPEEDRUN.md
```

## Architecture
- **Collision**: static world = list of AABBs (every level box auto-registers). Player is a capsule-ish AABB resolved per-axis. Enemy & weapon line-of-sight = segment-vs-AABB tests (no THREE.Raycaster against meshes — cheaper and deterministic).
- **Levels are data**: `{ env, geo:[{box, tex, pos, size}], lights, playerStart, enemies:[{type,pos,patrol}], objectives:[...], props }`. `buildLevel()` turns data into meshes + colliders. Missions are pure data + small script hooks.
- **Objectives** are a sequential array of steps (`goto`, `interact-hold`, `destroy-set` (any order), `defend`, `kill-boss`, `escape-timed`). Completing a step saves a checkpoint (player pos, ammo, enemies-alive mask, objective index).
- **Timer** counts from first input on M1, survives death/mission transitions, pauses only in pause menu. Splits per mission, PBs (campaign + per-level IL) in localStorage key `blacksite_v1`.
- **Enemies**: box-built humanoids, states IDLE/PATROL → ALERT → ATTACK ↔ COVER. 0.4 s raise-weapon telegraph before each burst. Budget ≤ 12 active.
- **Boss**: shield (immune) → shoot backpack generator node (visible orange) → vulnerable phase ×3, adds spawn between phases.

## Build order
1. Engine shell: renderer, pixel upscale, input, gray-box level, movement + slide.
2. Weapons + tracer/hitmarker + one Grunt with full AI.
3. Objective engine, timer/splits/checkpoints, HUD.
4. Missions 1–4 as data, mission-specific mechanics (defend, train, boss, escape).
5. Menus, level select, results, PBs. Self-test pass vs acceptance criteria. Docs.
