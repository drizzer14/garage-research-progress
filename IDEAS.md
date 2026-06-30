# Ideas Backlog

Recorded ideas for the mod. Entries are deleted once implemented.

## Open

### Tier-XI mode: "Final upgrade available" state
In tier-XI upgrade (skill-tree) mode, when only the final upgrade remains available,
drop the "Next available" chips block and instead show a "Final upgrade available"
label near the rightmost tick.

### Transitions / animations (if possible)
Add smooth CSS transitions for state changes — fill growth, hover scaling, show/hide,
mode switches — instead of hard cuts. Subject to what Gameface supports (some CSS is
clipped/dropped); confirm feasibility before relying on it.

### Enlarge ticks on hover
On hover, scale up the bar's ticks for emphasis/affordance, matching the hover
behavior already used for the tier-XI progression (skill-tree) chips/upgrades.

### Prepare for release on wgmods.net
Get the mod ready for publishing on the official WG mods portal (wgmods.net): whatever
the portal requires — listing/description, compatibility info, packaging — plus
**screenshots** of the bar in-game (to be taken by the author) for the listing.

### Draggable bar position (feasibility unknown)
Let the user drag the bar to reposition it, to avoid overlap/conflicts with other
mods' UI. Persist the dragged position (ties into the settings system / "bar position"
candidate). Feasibility under Gameface is unconfirmed — needs investigation.

### Color-blind mode support
When the game's color-blind mode is enabled, render the bar with proper colors —
ideally reusing WoT's own in-game color-blind palette/system rather than inventing
one. Relates to the "fill colors" candidate setting above.

### Installer update check
Installer fetches the latest mod version (initially from GitHub releases; later from
the official WG mods portal) and, if a newer version than the installed one is found,
suggests updating.

### Candidate settings (for the settings system in progress)
Everything below is currently hardcoded and would make a useful user setting. Listed
by likely demand; the settings framework being built is the vehicle for these.

**High impact**
- **Bar position** — vertical/horizontal anchor (`WGModResearch.css`: `top: 17.6vh`, `left: 50%`). For different resolutions, ultrawide/dual-screen.
- **Bar width / scale** (`WGModResearch.css`: `width: 520rem`). Shrink on small screens, grow on large.
- **Mode toggles** — let users hide bar modes they don't care about (tech-tree / field-mods / skill-tree / elite / elite-rewards). Gated in `domain/builder.py` priority chain.
- **Fill colors** — vehicle-XP, free-XP, complete, elite, elite-rewards fills (hardcoded hex in `WGModResearch.css` ~219–247). Accessibility/color-blind + theming.
- **Element visibility** — show/hide the category icon, the XP readout, the field-mod counter, and the "next available" skill-tree chips, for a minimal bar.

**Medium impact**
- **Shadow toggle/intensity** — pairs with the open drop-shadow idea above; let users dial it for light vs. dark hangars or turn it off (`WGModResearch.css` icon drop-shadow ~62, track shadow ~151).
- **Fill opacity** — free-XP fill and tick opacities (`WGModResearch.css` ~224/278/288/299).
- **Visibility override** — force always-show or never-show, on top of the existing auto-hide-in-loadout behavior (`gameface_bridge.py:482`, `visible` VM prop).
- **Click-to-research toggle** — view-only mode to prevent accidental spends.
- **Tooltips on/off** (`WGModResearch.js` hover handlers ~720–777).

**Low impact / niche**
- Custom or shortened mode labels (`WGModResearch.js` ~487).
- Click hit tolerance + hover proximity tuning (`WGModResearch.js` `CLICK_HIT_PCT` ~216, hover gate ~762).
- z-index, for conflicts with other UI mods (`WGModResearch.css:23`).
