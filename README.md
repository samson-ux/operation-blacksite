# OPERATION BLACKSITE

A retro-pixelated military FPS for the browser. Four-mission story campaign built to be
speedrun: always-on run timer, per-mission splits, personal bests, and movement tech
(slide-hopping, reload cancels) at the core.

**1994.** You are Sgt. Dana "Ash" Calloway. VULKAN, a rogue PMC, stole a satellite-guidance
package codenamed BLACKSITE. Get it back.

## How to run

**Option A (simplest):** double-click `index.html` — it runs directly in Chrome
(Three.js loads from CDN as a classic script; no modules, no build step).

**Option B (any browser / if your browser blocks file:// pages):**

```
npx serve operation-blacksite
```

then open the printed URL (e.g. http://localhost:3000). An internet connection is needed
either way for the Three.js CDN script.

Click the canvas to capture the mouse (pointer lock). Best times and settings are saved in
your browser's localStorage.

## Controls

| Input | Action |
|---|---|
| W A S D | Move |
| Mouse | Look / fire |
| Shift | Sprint |
| Space | Jump |
| **C (while sprinting)** | **Crouch-slide — keeps momentum; jump out of it to slide-hop** |
| R | Reload |
| 1 / 2 / 3 or scroll | Swap weapon (swapping cancels a reload) |
| E (hold) | Interact / plant / download · mount the train gun |
| F | Skip current radio line |
| Esc | Pause (stops the run timer) |

## The campaign

1. **Cold Open** — night dockyard. Breach the warehouse, pull the manifest, exfil. (target 4:00)
2. **Switchyard** — rail depot. Plant charges on 3 fuel tanks in any order, hold the signal tower 60 s, board the train. (target 5:00)
3. **Black Rain** — fight car-by-car up a storm-lashed train to the engine. (target 6:00)
4. **Vault** — descend the bunker, cut power in two switch rooms (either order), beat Commander Roth, grab BLACKSITE, and sprint the 90-second escape. (target 7:00)

Deaths respawn you at the last checkpoint **with the timer still running** — deaths cost
time, never the run. Finishing the campaign unlocks **Level Select** for individual-level
practice. Final rank: **S** < 18:00 · A < 21:00 · B < 25:00 · C < 30:00.

See `SPEEDRUN.md` for the routing notes and movement tech.
