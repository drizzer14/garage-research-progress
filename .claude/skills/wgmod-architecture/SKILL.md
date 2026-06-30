---
name: wgmod-architecture
description: Architecture and code conventions for the Garage Progress Bar WoT mod — the engine-free domain / adapter / Wulf-bridge layering, the mode state machine, and the Python-side data flows and gotchas (listener re-arming, Wulf MAP-arg, engine-free domain). Use whenever editing or extending the mod's Python, adding a new bar mode, tracing how a click becomes a research action, or debugging why the bar doesn't update. (For the JS/CSS widget rendering, see wgmod-widget; for live game symbols, see references/game-api.md.)
---

# wgmod architecture & conventions

Strict layering with read/write separation; the domain layer is engine-free and
unit-tested without the game.

```
src/res/scripts/client/
  gui/mods/mod_wgmod.py             # ENTRY POINT — monkey-patches a hangar sub-view
  wgmod_research/
    adapter/engine_adapter.py       # READ-ONLY: live game state -> VehicleSnapshot
    adapter/actions.py              # WRITE-ONLY: invoke WG's research/unlock APIs
    bridge/gameface_bridge.py       # Python <-> JS bridge (Wulf ViewModel + commands)
    domain/types.py                 # engine-free data types (2/3 compatible)
    domain/builder.py               # MODE STATE MACHINE
    domain/resolvers/{techtree,fieldmods,skilltree,elite}.py  # pure snapshot -> ticks
src/res/gui/gameface/mods/14th_ua/WGModResearch/
  WGModResearch.{js,css}            # widget: ModelObserver -> DOM render + click/hover (see wgmod-widget skill)
```

## Forward flow (game -> bar)
`mod_wgmod._install()` patches `HangarVehicleParamsPresenter._onLoading`. On each
mount it injects JS/CSS via `openwg_gameface.gf_mod_inject`, hangs a `ResearchVM` on
the sub-view model (property `wgResearch`), then `bridge.push()`:
`engine_adapter.build_snapshot()` → `builder.build_model()` (picks a `Mode`, calls the
matching resolver) → writes the `ResearchProgressModel` into the `ResearchVM` inside a
Wulf `transaction()`. JS `ModelObserver("WGModResearch")` re-renders.

## Reverse flow (clicks -> research)
JS `invokeCommand()` calls a Wulf command on `wgResearch` (`researchUnlock` /
`unlockFieldMod` / `openSkillTree`). The bridge handler reads the id and delegates to
`actions.py`, which runs WG's own unlock flow. Handlers do NOT refresh — the game's
resulting `onSyncCompleted` does.

## Mode state machine (`builder.build_model`, priority order)
TECH_TREE (any unlock remaining) → SKILL_TREE (tier-XI branching tree, count-based) →
FIELD_MODS → ELITE_REWARDS (unearned tier-XI milestone rewards) → ELITE (prestige
grade band) → COMPLETE. Each resolver returns ticks/dict the builder maps onto
`ResearchProgressModel`.

## Conventions that bite if you miss them
- **Listeners self-heal and re-arm on EVERY mount.** Battle exit tears down the hangar
  and rebuilds `g_currentVehicle.onChanged` with WG's presenters, dropping ours.
  `install_*_listener()` checks actual list membership (not a "did we subscribe" flag)
  and re-adds; `_onLoading` re-arms all three each mount.
- **Three listeners:** vehicle change (refresh), loadout/interactor (hide the bar while
  a tank-setup overlay is open), items-cache `onSyncCompleted` (live XP updates).
  Sync refreshes are coalesced onto the next tick via `BigWorld.callback(0.0, ...)`
  (one server action fires several syncs; deferring also lets `CurrentVehicle` rebuild
  first so XP is fresh).
- **Wulf commands take a single MAP arg.** JS wraps the id as `{value: id}`;
  `_cmd_int_arg` unwraps it. A bare scalar is rejected by Gameface as "not a map".
- **engine_adapter wraps every read in try/except** — one unreadable system degrades to
  a safe empty default and the rest of the bar still renders. Never let a read raise
  into the bridge.
- **actions.py never raises into JS** — every path falls back to opening WG's native
  screen rather than a silent spend or crash.
- **Domain layer is engine-free.** Resolvers/builder/types import no game symbols;
  game symbols live ONLY in `engine_adapter.py` and `actions.py` (catalogued in
  `references/game-api.md`). `tests/conftest.py` puts `src/res/scripts/client` on
  `sys.path` so tests run on pure snapshots — add a resolver/builder test there when you
  add behavior.

## Key data types (`domain/types.py`)
`VehicleSnapshot` (adapter output / domain input), `ResearchProgressModel` (builder
output → bridge writes into `ResearchVM`), `Tick` (one mark: `category` drives glyph +
clickability; `action_id` = tech-tree int_cd / field-mod step_id, 0 = not clickable).
The `ResearchVM`/`TickVM`/`UpgradeVM` Wulf shapes are defined in `gameface_bridge.py`
and must stay in sync with the JS reader (see the wgmod-widget skill).

## Adding a new read or write?
The concrete WoT/BigWorld symbols the adapter and actions depend on — and where they
live in the decompiled client — are catalogued in `references/game-api.md`. Read it
before adding a new game read (`engine_adapter.py`) or unlock action (`actions.py`).
