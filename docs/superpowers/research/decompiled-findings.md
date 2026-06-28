# Task 1 — Decompiled-Client Verification Spike (findings)

_Date: 2026-06-28 · Author: Claude Opus 4.8 (1M context) on the Windows PC._

**Verified against the CORRECT client:** `StranikS-Scan/WorldOfTanks-Decompiled` **branch `2.3`**,
which matches the owner's installed **WoT EU 2.3.0.1** client
(`D:\Games\World_of_Tanks_EU`, `version.xml` = `v.2.3.0.1 #892`). Cross-checked against the
module listing inside the live client's `res/packages/scripts.pkg`. Reference mods:
`wot-public-mods/battle-hits`, `ANIALLATOR114/extended-interface-scaling`.
All module paths below are relative to the EU source root `source/res/scripts/`.

> ## ⚠️ Correction to the first spike
> The first pass of this document was researched against the decompiled repo's **default
> branch, which is MirTankov 1.42 (the Lesta Studio RU fork)** — a *different, diverged*
> client from WoT EU. That produced two material errors, now fixed here:
> 1. **"Paragons"** (and an "elite milestone / level-150" ladder) is a **Lesta/RU-only
>    system. It does NOT exist in WoT EU 2.3.** Confirmed: zero `*paragon*` modules in the
>    EU source and zero in the live `scripts.pkg`. The owner correctly reported never seeing it.
> 2. The RU dump lacked `RandomHangar`; **EU 2.3 DOES have
>    `gui/impl/lobby/hangar/random/random_hangar.py`** (it is the current Garage view).
>
> **Net:** the game is the straightforward **XP-driven** model the owner described — research
> tech-tree items (incl. Tier XI vehicles) with XP, then unlock **Field Modifications**
> ("upgrades") with XP. No elite-milestone or Paragons system in EU.

---

## A. Selected vehicle & change event — CONFIRMED

**Module:** `client/CurrentVehicle.py`

- `g_currentVehicle = _CurrentVehicle()` (module global).
- `isPresent()` → `self.item is not None`.
- `.item` → `itemsCache.items.getVehicle(invID)` or `None` — a `gui_items.Vehicle.Vehicle`.
- `onChanged` is a WG `Event`; subscribe/unsubscribe with `+=` / `-=`. (Also `onChangeStarted`.)

```python
self.onChanged = Event(self._eManager)
...
g_currentVehicle.onChanged += handler   # established usage
```

---

## B. Vehicle gui_item & ItemsRequester/stats — CONFIRMED

**Modules:** `client/gui/shared/gui_items/Vehicle.py`,
`client/gui/shared/utils/requesters/ItemsRequester.py`, `.../statsrequester.py`,
`client/skeletons/gui/shared/__init__.py`.
_(Note: decompiled files are lowercase on disk — `vehicle.py`, `itemsrequester.py`,
`currentvehicle.py` — but the Python import names are `Vehicle`, `ItemsRequester`,
`CurrentVehicle`.)_

| Symbol | Verdict | Notes |
|---|---|---|
| `vehicle.xp` | CONFIRMED | unspent accumulated vehicle XP. |
| `vehicle.isElite` / `isFullyElite` | CONFIRMED | `isElite` = no unlock graph or in `stats.eliteVehicles`; `isFullyElite` = every unlock target already in `stats.unlocks`. |
| `vehicle.level` | CONFIRMED | `descriptor.type.level`, range **1..11**. |
| `vehicle.getUnlocksDescrs()` | CONFIRMED | generator → `(unlockIdx, xpCost, intCD, set(prereqs))`. Use this. |
| `vehicle.postProgression` | CONFIRMED | → `PostProgressionItem` (see §D). |
| `vehicle.userName` / `icon` | CONFIRMED | `icon` resolves a WG `R.images...` resource. |
| `item.itemTypeID` / `itemTypeName` | CONFIRMED | inherited from base gui_item; `'vehicle'` for vehicles. |
| `GUI_ITEM_TYPE.VEHICLE` | CONFIRMED | `client/gui/shared/gui_items/__init__.py`; modules = CHASSIS/TURRET/GUN/ENGINE/FUEL_TANK/RADIO. |
| `itemsCache.items.stats.freeXP` | CONFIRMED | account-global free XP (non-negative). |
| `itemsCache.items.stats.unlocks` | CONFIRMED | a **set** of unlocked intCDs. |
| `itemsCache.items.getItemByCD(cd)` | CONFIRMED | → `Vehicle` or a simple FittingItem. |
| `dependency.instance/descriptor(IItemsCache)` | CONFIRMED | both forms valid. |

---

## C. `unlocksDescrs` tuple order + Tier XI — CONFIRMED

**Stored tuple** on `VehicleType.unlocksDescrs` = `(xpCost, intCD, *prereqIntCDs)`
(index 0 = xpCost, 1 = intCD, 2+ = prerequisite intCDs). The plan's assumed
`(position, intCD, xpCost, ...)` was wrong — but the clean accessor avoids raw indexing:

```python
def getUnlocksDescrs(self):
    for unlockIdx, data in enumerate(self.descriptor.type.unlocksDescrs):
        yield (unlockIdx, data[0], data[1], set(data[2:]))   # (idx, xpCost, intCD, prereqs)
```

**Module vs next-vehicle:** `getTypeOfCompactDescr(intCD) == GUI_ITEM_TYPE.VEHICLE` → a next tank;
otherwise a module. (`parseIntCompactDescr` / `getTypeOfCompactDescr` in `common/items/__init__.py`.)
`researched = intCD in stats.unlocks`.

**Tier XI — CONFIRMED as ordinary tech-tree research.** `MAX_VEHICLE_LEVEL = 11`
(`common/constants.py`). `_readLevel` validates `1..11` with **no special-casing of 11**;
`unlocksDescrs` treats a `vehicle`-type unlock uniformly regardless of the target's tier. So a
Tier X vehicle that unlocks a Tier XI vehicle produces an ordinary
`(xpCost, vehicleIntCD, *prereqs)` entry — Tier XI is researched with XP like any tech-tree
successor. (Matches the owner's in-game experience. Data-model machinery confirmed;
concrete shipped XI `<unlocks>` XML edges live in game data, not the scripts tree.)

---

## D. Field Modifications = the **post-progression** system — CONFIRMED (XP-driven "upgrades")

**Modules:** `client/gui/veh_post_progression/models/progression.py` (`PostProgressionItem`),
`.../progression_step.py` (`PostProgressionStepItem`), `.../iterators.py`, `.../ext_money.py`,
`common/post_progression_common.py`, `common/post_progression_prices_common.py`,
`common/items/components/post_progression_components.py`.

- Accessor: `vehicle.postProgression` → `PostProgressionItem`. Availability:
  `vehicle.isPostProgressionExists` (property), `vehicle.isPostProgressionActive` (property),
  `vehicle.postProgressionAvailability(unlockOnly=False)` (method; **elite-gated** —
  `VEH_NOT_ELITE` when not elite). Rollup: `postProgression.getCompletion()` →
  `EMPTY`/`PARTIAL`/`FULL`.
- Steps: `postProgression.iterOrderedSteps()` (graph/BFS order), `getStep(id)`. Each
  `PostProgressionStepItem`: `stepID`, `getState()` →
  `RESTRICTED`/`LOCKED`/`UNLOCKED`/`RECEIVED`, `isReceived()`, `getLevel()`,
  `getParentStepIDs()`, `getNextStepIDs()`, `getPrice()` → `ExtendedMoney` (read `.xp`).
- **Price is per-step, currency `xp`** (`ALLOWED_CURRENCIES_FOR_TREE_STEP = {'xp'}`;
  `getPostProgressionPrice(priceTag, vehType)` keyed `priceTag → vehLevel → {currency: amount}`).
  Buying the 2nd pair-modification uses `credits` — filter to xp steps for the bar.
- **It is a DAG with per-step prices — NOT a cumulative threshold.** The mod must walk steps
  and sum prices to derive cumulative positions (the domain resolver already does this).
- Step name/icon are **not** on the step item directly — via `step.action` → `ActionItem`
  (`name`, `locName`, `imgName`).

**Adapter field-mod fields (per step):** `step_id`, `xp_cost = getPrice().xp` (skip non-xp
steps), `unlocked = isReceived()`, `state`, order from `iterOrderedSteps()`; overall:
`isPostProgressionExists` / `isPostProgressionActive` / `getCompletion()`.

---

## E. Elite-milestone / Paragons — **NOT-FOUND in EU (feature dropped)**

- No `*paragon*` modules in EU source or in the live `scripts.pkg`.
- `isElite` / `isFullyElite` are plain booleans (membership in `stats.eliteVehicles` + all
  modules unlocked). There is **no graded, cumulative-XP milestone ladder** and **no level 150**.
- `MAX_VEHICLE_LEVEL = 11` is a **tier**, not an elite level.

**Decision (owner, 2026-06-28):** drop the elite-milestone/Paragons feature. v1 = the
XP-driven per-vehicle bar (tech tree incl. Tier XI + field modifications). The domain `ELITE` /
`ELITE_PLUS_TIERXI_REWARDS` / Tier-XI-nodes paths are not produced by the EU adapter and will
be retired/dormant during the domain reconciliation.

---

## F. UI mounting & ViewModel (EU 2.3) — CONFIRMED, with a corrected approach

**`RandomHangar`** (`client/gui/impl/lobby/hangar/random/random_hangar.py`) is
`ViewComponent[RouterModel]` → `ViewImpl` → wulf `View`. It is a **router/container**: it has
**no data ViewModel** (its model is `RouterModel`) and **no `_initialize`**. Lifecycle hooks are
`_onLoading` / `_finalize` / `_subscribe` / `_unsubscribe` / `_getChildComponents`. Vehicle data
is pushed by its **child presenters** (e.g. `CrewPresenter`, `LoadoutPresenter`), each owning a
sub-view ViewModel and calling `with self.viewModel.transaction() as tx:`. Child presenters wire
`g_currentVehicle.onChanged` in their own `_getEvents`.

**Two ways to mount a custom widget:**
- **(A) Child component:** monkey-patch `RandomHangar._getChildComponents` to add
  `{<anchorId>: MyPresenterFactory}` (needs a free hangar layout anchor —
  `R.aliases.hangar.shared.*`).
- **(B) `InjectComponentAdaptor` (recommended template):** copy
  `gui/Scaleform/daapi/view/lobby/hangar/battle_matters_entry_point.py` +
  `gui/impl/lobby/battle_matters/battle_matters_entry_point_view.py`. It self-mounts onto the
  main window content (no anchor needed); the injected view is a normal `ViewImpl` with its own
  `viewModel` / `_getEvents` / `transaction()`.

**Custom view + model:** subclass `ViewImpl` (+ `ViewModel`). ViewModel base API (confirmed via
generated models): `_addStringProperty` / `_addNumberProperty` / `_addBoolProperty` /
`_addArrayProperty(name, Array())` / `_addViewModelProperty(name, SubModel())` / `_addCommand`;
typed getters/setters `_getNumber/_setNumber`, `_getArray/_setArray`, etc.; refresh happens on
`transaction()` exit (no explicit `invalidate()` needed). Wire `g_currentVehicle.onChanged` in
`_getEvents`; push the model inside `with self.viewModel.transaction() as tx:`, filling the ticks
array via `getTicks()` (an `Array`) with `addViewModel(child)` per tick.

```python
from frameworks.wulf import Array, ViewModel
class ResearchProgressModel(ViewModel):
    def __init__(self, properties=6, commands=0):
        super(ResearchProgressModel, self).__init__(properties=properties, commands=commands)
    def _initialize(self):
        super(ResearchProgressModel, self)._initialize()
        self._addStringProperty('mode', '')
        self._addNumberProperty('scaleMin', 0)
        self._addNumberProperty('scaleMax', 0)
        self._addNumberProperty('fillSpendable', 0)
        self._addNumberProperty('fillEarned', 0)
        self._addArrayProperty('ticks', Array())
```

**Packaging / deps:** `.wotmod` = stored ZIP, `meta.xml` at root + `res/` tree, `.py`→`.pyc`
with **Python 2.7** (`build/build_wotmod.py` handles this). OpenWG Gameface is a hard dependency
(import at module top; abort if missing) — **already installed** in the owner's client
(`mods/2.3.0.1/net.openwg`). Gameface assets under
`res/.../gui/gameface/mods/<author>/<View>/{html,css,js}` + a
`mods/configs/res_map/<View>.json` (`type: Layout`, `impl: gameface`, `entrance`, `itemID`),
resolved in Python via `openwg_gameface.ModDynAccessor("<itemID>")`.

---

## Spec §11 item-by-item resolution (EU 2.3)

| # | Open item | Result |
|---|---|---|
| 1 | `unlocksDescrs` tuple order | **§C** — `(xpCost, intCD, *prereqs)`; use `getUnlocksDescrs()`. |
| 2 | Post-progression accessor + step fields | **§D** — `vehicle.postProgression`; per-step state + `getPrice().xp`, graph-ordered. |
| 3 | Do Tier XI nodes reuse post-progression? | **§C/§D** — there is no separate "Tier XI node" system; Tier XI is a normal tech-tree vehicle, and (once owned) has field modifications like any vehicle. |
| 4 | Elite data / caps | **§E** — NONE in EU. Feature dropped (owner decision). |
| 5 | Current hangar view class path | **§F** — `gui.impl.lobby.hangar.random.random_hangar.RandomHangar` (router; mount via InjectComponentAdaptor or `_getChildComponents`). |
| 6 | ViewModel field/command syntax | **§F** — wulf `ViewModel` + `transaction()` + `Array`/`addViewModel`. |

---

## Net plan deltas for Phase 2

1. **Adapter (Task 9):** read tech unlocks via `getUnlocksDescrs()` → `(xpCost, intCD)`; classify
   module vs next-vehicle (incl. Tier XI) via `getTypeOfCompactDescr`/`GUI_ITEM_TYPE.VEHICLE`;
   `researched = intCD in stats.unlocks`. Read field mods via `vehicle.postProgression`
   (`iterOrderedSteps`, `getPrice().xp`, `isReceived`). No elite/Paragons/Tier-XI-node reads.
2. **Domain (Task 7 reconcile):** keep `techtree` + `fieldmods` resolvers and `TECH_TREE` +
   field-mod research mode. Tier XI needs no special "successor/potential/nodes" path (it's a
   normal tech-tree vehicle tick). Retire/cordon the `elite` resolver and `ELITE*` / `TIERXI_NODES`
   modes (no EU data source). Confirm final mode set with owner.
3. **UI (Tasks 10–12):** mount via `InjectComponentAdaptor` (or `_getChildComponents`), our own
   `ViewImpl` + `ViewModel`; do **not** patch `RandomHangar._initialize`.
4. **Packaging (Task 13):** Python 2.7.18; OpenWG Gameface already present in the client.
