---
name: wgmod-widget
description: Front-end (Gameface HTML/CSS/JS) conventions for the Garage Progress Bar WoT mod's widget — the DOM structure, the img:// game-icon URL maps, the pointer-events layering, per-mode render branches, hover/click hit-testing, and Gameface CSS quirks. Use whenever editing WGModResearch.js or WGModResearch.css, changing how the bar/ticks/tooltips/chips look or behave, fixing a glyph or icon, adjusting hover/click behavior, or wiring a new tick category into the renderer.
---

# wgmod widget (front-end) conventions

The widget is `src/res/gui/gameface/mods/14th_ua/WGModResearch/WGModResearch.{js,css}`,
injected into the hangar document by OpenWG. It reads the Python data model (exposed as
`wgResearch`) via `ModelObserver("WGModResearch")` and renders a single-axis XP bar.
For the Python side that produces that model, see the **wgmod-architecture** skill.

## Lifecycle
`engine.whenReady` → `observer.onUpdate(render)` → `observer.subscribe()` →
`render(observer.model)`. In `render`, read the model with `unwrap(model.wgResearch)`
(Wulf wraps values; `unwrap` peels the proxy). `data.visible === false` → hide the
root and bail (the Python loadout listener sets this while a tank-setup overlay is open).

## DOM structure
```
#wgmod-root (pointer-events:none)
  .wg-head   .wg-cat-icon | .wg-head-left(.wg-label,.wg-upgrades) | .wg-xp(.wg-xp-val,.wg-xp-ico)
  .wg-track  .wg-fill-veh + .wg-fill-free (stacked) | .wg-ticks(.wg-tick…) | .wg-hot | .wg-tooltip
  .wg-next   .wg-next-cap + .wg-chip…   (skill_tree only)
```
Mode is applied as a root class (`wg-complete`, `wg-elite`, `wg-elite-rewards`, …) that
CSS keys off for per-mode fill colors and icon sizing.

## pointer-events layering (don't break this)
`#wgmod-root` is `pointer-events:none` so it never steals the hangar's drag-to-rotate.
The ONLY re-enabled layer is **`.wg-hot`** (`pointer-events:auto`, `z-index:3`, topmost)
— a transparent overlay spanning the bar AND the glyph strip below it. Ticks and the
tooltip stay `pointer-events:none`. So ALL hover/click is driven from the `.wg-hot`
handlers in JS, not CSS `:hover`; the clickable cue is a JS-set pointer cursor, not a
`:hover` rule. The tooltip is `z-index:4` (above `.wg-hot`) but non-interactive.

## Icon URL conventions (img:// into game art)
Defined as constants at the top of the JS; reuse the in-game art so the bar matches WG's
own screens:
- `CAT_ICON[mode]` — header glyph per mode (`vehicleMenu/large/{research,fieldModification,vehSkillTree}.png`).
- `XP_ICON` (`vehicle_hub/research_purchase/total_experience.png`) — Total-XP readout; the
  game's `_elite` variant is lower-quality art, so the base glyph is used everywhere.
- `COMBAT_XP_ICON` (`library/xpIcon_23x22.png`) — elite mode only (cumulative combat XP).
- `SKILL_COUNTER_ICON` — the unlocked/total node counter glyph (skill_tree).
- `eliteIcon(vehClass)` — COMPLETE badge; class ids use `-`, files use `_`
  (`AT-SPG` → `AT_SPG_elite.png`).
- Prestige emblems arrive on the tick as `t.icon`
  (`prestige/emblem/<size>/<family>/<sub>.png`); `gradeFamily()` parses `<family>` and the
  level number is drawn as `emblemFont/<family>/<digit>.png` glyph divs (NOT CSS text),
  `enamel` → `gold` fallback, the `1` glyph is narrower (`wg-emblem-digit-one`).

## Per-mode render branches (`render`)
- **tech_tree / field_mods** — linear: ticks at `pct(t.position)`; tech-tree draws a
  module/vehicle glyph, field-mods a hexagon with `romanize(t.level)`.
- **skill_tree** — count axis; evenly-spaced ticks carry no per-node metadata (so no
  tooltips), the FINAL tick carries the icon (framed perk glyph) and below the bar
  `renderNextAvailable()` draws clickable chips (`wg-chip-major` for ≥20k XP nodes, else
  `wg-chip-minor`). `upgradesSig()` lets `render` skip rebuilding identical chips (a
  rebuild would destroy the hovered chip's tooltip element).
- **elite** — grade-band ticks with the prestige hexagon emblem + emblem-font level.
- **elite_rewards** — reward-thumbnail ticks; `t.state` (`achieved`/`next`/`upcoming`)
  drives the pip/thumbnail coloring via `wg-state-*` classes.
- **complete** — no ticks; full green bar + class elite badge.

## Hover & click hit-testing
- **Hover** is two-tier: the exact element under the cursor (read `_wgBody` off the
  ancestor `.wg-tick`) when Gameface deep-targets, else nearest tick by cursor-x over the
  `tickMeta` list. skill_tree has only the final-tick tooltip, gated by proximity
  (`bestD <= 6`) so it doesn't show across the empty bar.
- **Click** (`.wg-hot` click handler): try `chipAt()` (exact chip box) first, else
  `nearestClick()` (nearest CLICKABLE tick within `CLICK_HIT_PCT`). Then `invokeCommand()`.
- **Clickability → command** (set while building `clickMeta`): skill_tree → only the final
  (icon) tick → `openSkillTree`; field-mod → only the NEXT (first remaining) tick, if
  affordable → `unlockFieldMod` (arg `actionId`); tech-tree (`vehicle`/`module`) →
  affordable && !locked → `researchUnlock` (arg `actionId`).
- `invokeCommand(name, arg)` calls the Wulf command on `wgResearch`, wrapping the id as
  **`{value: arg}`** (a bare scalar is rejected by Gameface as "not a map"); no-arg
  commands (`openSkillTree`) are called bare.

## Gameface quirks (the usual culprits)
- Gameface clips `<img>` — render glyphs as `background-image` divs with
  `background-size: contain`.
- A CSS declaration is dropped WHOLE if a `var()` doesn't resolve (the fallback hex is
  ignored too) — so colors are hard-coded hex, not custom properties.
- Sizes are in `rem`; the engine scales the root font, so `rem` keeps the bar
  resolution-stable.
