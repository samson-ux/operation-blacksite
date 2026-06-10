# DECISIONS.md — choices made autonomously

## Tech
- **Three.js r128 UMD (classic script) instead of modern ES-module builds.** Modern Three
  releases are module-only and `import` from file:// fails CORS — r128 is the last
  generation with a global-`THREE` UMD build on cdnjs, which lets the game run by
  double-clicking `index.html` with no server. Nothing in the game needs a newer API.
- **No render-to-texture pass for the pixel look.** The renderer's backbuffer is simply
  320×180 (`setSize(..., false)`) and the canvas is CSS-upscaled with
  `image-rendering: pixelated`. Identical result to an offscreen target, less code, faster.
- **Letterboxing instead of stretch-to-fill.** The spec says "upscale to full screen";
  full-bleed stretching distorts aim on non-16:9 windows, so the canvas scales to the
  largest 16:9 rectangle and the bars stay black.
- **Custom AABB collision/raycast instead of THREE.Raycaster.** All level geometry is
  boxes, so segment-vs-AABB slab tests are exact, allocation-free, and independent of mesh
  triangulation. Player/enemies resolve per-axis against the same box list.
- **HTML/CSS overlays for all UI.** Crisper than canvas text at 320×180, trivially
  skinnable, and guarantees dialogue/HUD can never block the simulation.

## Gameplay
- **Hold-to-interact progress pauses rather than resets** when you release E or get pushed
  off the point. Reset-on-release punishes the aggressive play the game is built around.
- **Interact-defense spawns trigger on first touch of the console**, not on objective
  start — so a speedrunner who routes straight to the console controls when the fight starts.
- **Pistol has infinite reserve; rifle/shotgun have generous (4-mag) reserves.** No ammo
  pickups exist; the pistol is the designed fallback and fast-swap reload-cancel tool.
- **Enemy accuracy scales down with player speed (and further while sliding).** This is the
  mechanical backbone of "aggressive speedrun play is viable": standing still is the most
  dangerous thing you can do.
- **Boss turns at 2.2 rad/s (vs 7 for regular enemies)** so slide-flanking his backpack
  generator is beatable by movement skill rather than RNG. Shield blocks body damage
  entirely; the pack is hittable from flank/rear angles.
- **Boss = 600 hp, phases at 400/200**: pack (120 hp) breaks the shield, body damage until
  the next threshold re-shields and spawns adds. Adds don't need to die.
- **Escape-timer failure deals lethal damage** instead of a custom fail state — it reuses
  the death→checkpoint path (timer keeps running), so it can't soft-lock.
- **Defend timer counts down unconditionally** (no "stay in zone" requirement). The fixed
  60 s is the mission's pacing cost; survival is the challenge.
- **The M3 train doesn't physically move.** Motion is sold by storm rain, fog, and the
  ground plane far below. A genuinely moving sim adds physics complexity with zero
  gameplay difference on board.
- **Mounted gun is a casual-play option, deliberately time-negative** for runners
  (documented in SPEEDRUN.md), satisfying "skippable for speed if you push past".
- **M1 ends at the crane elevator pad** (touch trigger) rather than a ride sequence —
  mission-end fade is capped at 1 s per spec, so an elevator cutscene would violate it.

## Visual & content upgrade (post-release)
- **Red enemy outlines** use back-face shells (scaled clones with `side: BackSide`) parented
  to each body part so they follow walk/telegraph animations — no postprocessing needed in r128.
- **Scout/Sniper/Riot** added on top of the original three: Scout punishes pure skip-running
  (it chases), Sniper adds a visible-laser dodge mini-game at range, Riot's frontal block is
  solved by the slide — every new type reinforces the movement-first design.
- Sniper lasers are FX tracers re-emitted every 0.1 s during the 0.9 s telegraph — cheap and
  readable through the M3 storm.
- Riot frontal block is resolved in the hitscan (facing·shotDir < 0.2 → spark, no damage),
  not a separate hitbox — headshots from behind still work.
- Decor is data-only (`cyl` and `basic`-material flags in the level builder); solid only
  where it doubles as cover (pillars, shelving). The M1 office cage initially re-created the
  "geometry crowds the objective radius" bug class — caught by the campaign regression bot,
  fixed by widening the cage and the interact radius.

## Speedrun systems
- **Campaign timer starts on the first input of Mission 1**, not on load — menu/loading
  time is never part of a run.
- **Death keeps the timer running; pause stops it.** Per spec. Death screen requires a
  click to respawn so a runner controls when the checkpoint reload starts.
- **Campaign splits also credit IL PBs** (a great campaign segment counts as your IL best),
  matching how IL boards usually work.
- **Checkpoints save:** objective index, player position/loadout/ammo, all currently-alive
  enemies (at their current positions), removed level geometry (breached doors, blown
  tanks), and partial multi-objective progress (each planted charge/breaker checkpoints).
- **Checkpoint restore rebuilds the whole scene from level data** — procedural levels make
  this a few milliseconds, and it guarantees no stale-state soft-locks.

## Verification performed
- Full campaign completed end-to-end by a scripted bot driving real input events +
  `Game.tick()` — all 16 objectives, all three boss shield phases, escape, results screen,
  rank, PB write, level-select unlock. Zero console errors across the whole run.
- Unit-style checks via the live page: sprint 8.0 m/s vs slide 9.65 m/s at +0.5 s
  (slide faster than sprint ✓), slide-hop preserves speed exactly in air ✓, reload cancel
  via swap ✓, headshot 48 vs body 24 ✓, boss frontal damage blocked while shielded ✓,
  death → checkpoint respawn with timer still counting ✓, pause freezes timer ✓,
  multi-objective progress survives death ✓, mounted gun mount/fire/dismount ✓.
- Heaviest-fight load (12 active enemies + 30 tracers + rain) simulated at ~0.5 ms per
  frame — far inside the 16.6 ms / 60 FPS budget.
- One level-data bug found and fixed during testing: the M2 signal-tower railing was
  placed across the platform center, blocking the objective radius (moved to the north edge).
  Three balance/correctness bugs found and fixed: slide friction too strong, air-control
  allowing free acceleration past slide speed, and full-height body hitboxes eating
  headshots.
