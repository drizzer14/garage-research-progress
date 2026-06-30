// WGMod research-progress widget. Injected into the hangar document by OpenWG.
// Reads our data model (exposed as `wgResearch` on the host sub-view's model)
// via ModelObserver, and renders a single-axis XP bar with stacked fill + ticks.
import { ModelObserver } from "../../libs/model.js";

const observer = ModelObserver("WGModResearch");

// Category icon for the bar header -- the same art the in-game "Vehicle
// management" menu uses for each section. Keyed by bar mode.
const CAT_ICON = {
    tech_tree: "img://gui/maps/icons/hangar/vehicleMenu/large/research.png",
    field_mods: "img://gui/maps/icons/hangar/vehicleMenu/large/fieldModification.png",
    // Tier-XI vehicle skill tree -> the dedicated "Upgrades" vehicle-management
    // section glyph (white tank + node network), matching research/fieldMod above.
    skill_tree: "img://gui/maps/icons/hangar/vehicleMenu/large/vehSkillTree.png",
};

// Skill-tree (Tier-XI upgrades) mode replaces the right-side Total-XP readout with
// an "unlocked / total nodes" counter, fronted by the in-game Upgrades-screen
// counter glyph (the small chevron shown beside its own node counter).
const SKILL_COUNTER_ICON = "img://gui/maps/icons/skillTree/tree/counter.png";

// Total spendable XP for this vehicle's research = the vehicle's accumulated
// combat XP + the account-global free XP -- exactly how the in-game research
// screen totals it (techtree getVehTotalXP = freeXP + vehXP). Uses that screen's
// own "Total XP" row glyph (vehicle_hub/research_purchase/total_experience). The
// game also ships an `_elite` variant, but its art is drawn smaller + offset low
// in the same 16x16 canvas (no higher-res source), so it reads as lower quality;
// we use the clean base glyph in every mode instead.
const XP_ICON = "img://gui/maps/icons/vehicle_hub/research_purchase/total_experience.png";

// The plain combat-XP currency glyph (gray star) -- used ONLY by the elite-mode
// readout, which shows cumulative COMBAT XP (no free XP), unlike the other modes'
// combined Total-XP star above. Verified by viewing the PNG (its free-XP sibling
// freeXpIcon_23x22 confirms it's the standard combat/free pair).
const COMBAT_XP_ICON = "img://gui/maps/icons/library/xpIcon_23x22.png";

// Elite badge for the COMPLETE state: the in-game class+elite icon. veh class
// ids use '-' (AT-SPG); the icon files use '_' (AT_SPG_elite.png).
function eliteIcon(vehClass) {
    if (!vehClass) return "";
    return "img://gui/maps/icons/vehicleTypes/md/" +
        vehClass.replace(/-/g, "_") + "_elite.png";
}

// The ELITE grade tick renders the in-game prestige HEXAGON EMBLEM -- the exact
// badge the hangar carousel vehicle tooltip shows (game component
// PrestigeProgressSymbol: a single emblem PNG drawn once, no backing/glow/blend).
// The 72x72 emblem art is solid (~245/255 alpha over the shape), so one draw reads
// opaque on the hangar -- no stacking trick needed (that was for the translucent
// chevron `tab` art, now retired). The emblem URL arrives on the tick as t.icon
// (.../prestige/emblem/<size>/<family>/<sub>.png, or .../prestige.png for MAX).
const GRADE_FAMILIES = { iron: 1, bronze: 1, silver: 1, gold: 1, enamel: 1 };
function gradeFamily(emblemUrl) {
    // emblem URL is .../prestige/emblem/<size>/<family>/<sub>.png -- pull <family>.
    const m = /\/emblem\/\d+x\d+\/([a-z]+)\//.exec(emblemUrl || "");
    const fam = m ? m[1] : "";
    return GRADE_FAMILIES[fam] ? fam : "";
}
// The level number is drawn the same way the tooltip's PrestigeProgressLabel does:
// a row of grade-colored emblemFont digit glyphs (NOT a CSS text number). The glyph
// art is itself colored per grade, so no CSS tint is applied. emblemFont has no
// `enamel` set -> fall back to gold (matches the amber tint enamel used previously).
function emblemFontFamily(family) {
    return family === "enamel" ? "gold" : (family || "gold");
}
function emblemFontUrl(family, digit) {
    return "img://gui/maps/icons/prestige/emblemFont/16x33/" +
        emblemFontFamily(family) + "/" + digit + ".png";
}
// The level number centered over the hexagon emblem: a flex row of emblemFont digit
// glyph divs (Gameface clips an <img>, so each glyph is a background-image div). The
// "1" glyph is narrower in the game art, so flag it for a tighter width.
function emblemNumber(level, family) {
    const wrap = document.createElement("span");
    wrap.className = "wg-tick-emblem-num";
    const s = String(level);
    for (let i = 0; i < s.length; i++) {
        const d = document.createElement("span");
        d.className = "wg-emblem-digit" + (s[i] === "1" ? " wg-emblem-digit-one" : "");
        d.style.backgroundImage = "url('" + emblemFontUrl(family, s[i]) + "')";
        wrap.appendChild(d);
    }
    return wrap;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function romanize(n) {
    n = n | 0;
    if (n > 0 && n < ROMAN.length) return ROMAN[n];
    return n > 0 ? String(n) : "";
}

// XP with thousand-separators. Defaults to WoT's native space separator (used in
// the tooltip); the header Total-XP counter passes "," for comma grouping.
function fmtXp(n, sep) {
    n = n | 0;
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep || " ");
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Display name for a tick. Field-mod names may be empty (the engine label
// lookup can miss); fall back to "Field Modification <level>".
function tickName(t) {
    if (t.name) return t.name;
    if (t.category === "fieldmod") {
        const r = romanize(t.level);
        return r ? "Field Modification " + r : "Field Modification";
    }
    return "";
}

// Tooltip body for a tick. For a field-mod level that offers an A/B choice the
// TITLE is its two selectable variants (each distinct) under a small level
// caption -- the leveled step's own base-mod label repeats across every choice
// level, so titling by it made them all read identically. Every other tick
// (single-mod field levels, tech-tree) keeps the base name as the title. XP sits
// below the title; a status line is appended when the tick is locked.
function tooltipHtml(t) {
    const opts = (t.options || "").split("\n").filter(function (s) { return s; });
    let html = "";
    if (t.category === "fieldmod") {
        // "Field Modification <level>" sub-header on EVERY field-mod tick (incl. the
        // toggleable single mods, not just the choice-pair levels).
        const r = romanize(t.level);
        if (r) html += '<div class="wg-tip-caption">Field Modification ' + r + "</div>";
        if (opts.length) {
            // Choice pair: the variants are the title; the container scopes the "or"
            // separator (CSS) so it sits between them, not after the last.
            html += '<div class="wg-tip-variants">';
            for (let i = 0; i < opts.length; i++) {
                html += '<div class="wg-tip-variant">' + escapeHtml(opts[i]) + "</div>";
            }
            html += "</div>";
        } else {
            const name = tickName(t);
            if (name) html += '<div class="wg-tip-name">' + escapeHtml(name) + "</div>";
        }
        html += '<div class="wg-tip-xp">' + fmtXp(t.xpRequired || 0) + " XP</div>";
    } else {
        const name = tickName(t);
        if (name) html += '<div class="wg-tip-name">' + escapeHtml(name) + "</div>";
        html += '<div class="wg-tip-xp">' + fmtXp(t.xpRequired || 0) + " XP</div>";
    }
    if (t.locked) {
        html += '<div class="wg-tip-status">Prerequisites not met</div>';
    }
    return html;
}

function setCatIcon(el, url) {
    if (url) {
        el.style.backgroundImage = "url('" + url + "')";
        el.style.display = "block";
    } else {
        el.style.backgroundImage = "";
        el.style.display = "none";
    }
}

function setUpgrades(el, done, total) {
    if (total > 0) {
        el.textContent = done + "/" + total;
        el.style.display = "block";
    } else {
        el.textContent = "";
        el.style.display = "none";
    }
}

// Right-side readout of the TOTAL spendable XP (vehicle combat XP + global free
// XP), with the native experience glyph to the right of the figure. Shown in
// every mode -- available XP stays meaningful even once the tank is researched.
function setXp(root, vehXp, freeXp) {
    root.querySelector(".wg-xp-ico").style.backgroundImage =
        "url('" + XP_ICON + "')";
    root.querySelector(".wg-xp-val").textContent =
        fmtXp((vehXp || 0) + (freeXp || 0), ",");
}

// wulf exposes nested viewmodels / array elements wrapped as { value: ... }.
function unwrap(x) {
    return x && x.value !== undefined ? x.value : x;
}

// Invoke a reverse-channel command on our ResearchVM (exposed as `wgResearch` on
// the host model). Wulf surfaces a ViewModel command as a callable on the model;
// whether it lives on the wrapped proxy or its unwrapped value can differ across
// builds, so try both. `arg` is omitted for the no-arg command (openSkillTree).
function invokeCommand(name, arg) {
    try {
        const vm = observer.model && observer.model.wgResearch;
        let host = null;
        if (vm && typeof vm[name] === "function") host = vm;
        else {
            const inner = unwrap(vm);
            if (inner && typeof inner[name] === "function") host = inner;
        }
        if (!host) { console.error("[wgmod] command missing: " + name); return; }
        // Wulf commands take a single MAP argument (a raw scalar is rejected by
        // Gameface as "not a map"); wrap the id so Python can read it back out.
        if (arg === undefined || arg === null) host[name]();
        else host[name]({ value: arg });
    } catch (e) {
        console.error("[wgmod] invokeCommand failed: " + name, e);
    }
}

// Nearest CLICKABLE tick to a cursor x (from hotEl._wgClickMeta), gated by a small
// proximity window so a click on the bare bar between ticks doesn't fire an action.
// Imprecise hits are additionally backstopped by WG's confirm dialog (Python side).
const CLICK_HIT_PCT = 4;
function nearestClick(hotEl, clientX) {
    const meta = hotEl._wgClickMeta;
    if (!meta || !meta.length) return null;
    const rect = hotEl.getBoundingClientRect();
    const w = (rect && rect.width) || hotEl.clientWidth || 1;
    const left = rect ? rect.left : 0;
    const curPct = ((clientX - left) / w) * 100;
    let best = null, bestD = 1e9;
    for (let i = 0; i < meta.length; i++) {
        const d = Math.abs(meta[i].left - curPct);
        if (d < bestD) { bestD = d; best = meta[i]; }
    }
    return best && bestD <= CLICK_HIT_PCT ? best : null;
}

function ensureRoot() {
    let root = document.getElementById("wgmod-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "wgmod-root";
        root.innerHTML =
            '<div class="wg-head">' +
            '<div class="wg-cat-icon"></div>' +
            '<div class="wg-head-left">' +
            '<div class="wg-label"></div>' +
            '<div class="wg-upgrades"></div>' +
            "</div>" +
            '<div class="wg-xp">' +
            '<span class="wg-xp-val"></span>' +
            '<span class="wg-xp-ico"></span>' +
            "</div>" +
            "</div>" +
            '<div class="wg-track">' +
            '<div class="wg-fill wg-fill-veh"></div>' +
            '<div class="wg-fill wg-fill-free"></div>' +
            '<div class="wg-ticks"></div>' +
            '<div class="wg-hot"></div>' +
            '<div class="wg-tooltip"></div>' +
            "</div>" +
            '<div class="wg-next"></div>';
        document.body.appendChild(root);
    }
    return root;
}

function arrLen(a) {
    if (!a) return 0;
    if (typeof a.length === "number") return a.length;
    if (typeof a.count === "number") return a.count;
    return 0;
}

// Tier-XI "Next available:" row below the bar: a caption + one clickable chip per
// available frontier node (perk icon, hover tooltip with name + XP cost, click to
// unlock). Hidden when nothing is available. The signature FINAL upgrade stays on
// the bar itself (its rightmost end tick), separate from this row.
//
// The chips are VISUAL ONLY (pointer-events:none -- in this Coherent build, elements
// nested under the pointer-events:none root don't reliably receive events even with
// pointer-events:auto). Interaction is routed through the .wg-hot overlay (the one
// proven-interactive layer, which spans this row's area): we register each chip's
// element + command + tooltip in hotEl._wgChips, and ensureHover() hit-tests them by
// bounding rect for hover (toggling the chip's own .wg-chip-tip) and click.
function renderNextAvailable(nextEl, arr, hotEl) {
    nextEl.innerHTML = "";
    const chips = [];
    const n = arrLen(arr);
    if (n) {
        const cap = document.createElement("span");
        cap.className = "wg-next-cap";
        cap.textContent = "Next available:";
        nextEl.appendChild(cap);
        for (let i = 0; i < n; i++) {
            const u = unwrap(arr[i] !== undefined ? arr[i] : arr.get && arr.get(i));
            if (!u) continue;
            const xp = u.xpRequired | 0;
            // Match the Upgrades screen: minor (10k) -> square plate; major
            // (>=20k: 20k/25k) -> diamond. Frame + perk glyph layered.
            const chip = document.createElement("div");
            chip.className = "wg-chip " + (xp >= 20000 ? "wg-chip-major" : "wg-chip-minor");
            const frame = document.createElement("div");
            frame.className = "wg-chip-frame";
            const ico = document.createElement("div");
            ico.className = "wg-chip-ico";
            if (u.icon) ico.style.backgroundImage = "url('" + u.icon + "')";
            chip.appendChild(frame);
            chip.appendChild(ico);
            const tip = document.createElement("div");
            tip.className = "wg-chip-tip";
            let html = "";
            if (u.name) html += '<div class="wg-tip-name">' + escapeHtml(u.name) + "</div>";
            if (xp > 0) html += '<div class="wg-tip-xp">' + fmtXp(xp) + " XP</div>";
            tip.innerHTML = html;
            chip.appendChild(tip);
            nextEl.appendChild(chip);
            chips.push({ el: chip, tip: tip, cmd: "unlockFieldMod", arg: u.actionId });
        }
        nextEl.style.display = "flex";
    } else {
        nextEl.style.display = "none";
    }
    if (hotEl) hotEl._wgChips = chips;
}

// Signature of the available-upgrade set, so render() can skip rebuilding identical
// chips (a rebuild destroys the hovered chip's tooltip element).
function upgradesSig(arr) {
    const n = arrLen(arr);
    let s = n + ":";
    for (let i = 0; i < n; i++) {
        const u = unwrap(arr[i] !== undefined ? arr[i] : arr.get && arr.get(i));
        if (u) s += (u.actionId | 0) + "," + (u.xpRequired | 0) + ";";
    }
    return s;
}

// The chip (in hotEl._wgChips) whose on-screen box contains the cursor, or null.
function chipAt(hotEl, clientX, clientY) {
    const chips = hotEl._wgChips;
    if (!chips || !chips.length) return null;
    for (let i = 0; i < chips.length; i++) {
        const r = chips[i].el.getBoundingClientRect();
        if (r && clientX >= r.left && clientX <= r.right &&
            clientY >= r.top && clientY <= r.bottom) return chips[i];
    }
    return null;
}

// Toggle the framed chip tooltip (+ a hover lift) for the hovered chip, clearing any
// previously-active one. Driven from the .wg-hot handler, not CSS :hover.
function setActiveChip(hotEl, chip) {
    const prev = hotEl._wgActiveChip;
    if (prev && prev !== chip) {
        prev.tip.style.display = "none";
        prev.el.classList.remove("wg-chip-hot");
    }
    if (chip) {
        chip.tip.style.display = "block";
        chip.el.classList.add("wg-chip-hot");
    }
    hotEl._wgActiveChip = chip || null;
}

function render(model) {
    const root = ensureRoot();
    const label = root.querySelector(".wg-label");
    const catIcon = root.querySelector(".wg-cat-icon");
    const upgradesEl = root.querySelector(".wg-upgrades");
    const data = unwrap(model && model.wgResearch);

    const xpEl = root.querySelector(".wg-xp");
    // Tier-XI "next upgrade available" CTA below the bar. Bound once; hidden by
    // default and only shown by the skill_tree branch below. Clicking it opens
    // WG's skill-tree screen (same command as the final tick).
    // Tier-XI "Next available:" row (caption + clickable upgrade chips) below the
    // bar. Hidden by default; the skill_tree branch shows it and (re)builds the chips
    // only when the upgrade set changes -- NOT every render -- so the hovered chip's
    // tooltip survives background pushes (rebuilding destroyed it, hence it only
    // appeared while the cursor was moving).
    const nextEl = root.querySelector(".wg-next");
    if (nextEl) nextEl.style.display = "none";

    if (!data) {
        const keys = model ? Object.keys(model).join(",") : "no-model";
        label.textContent = "WGMOD: waiting for data | keys=" + keys;
        setCatIcon(catIcon, "");
        setUpgrades(upgradesEl, 0, 0);
        xpEl.style.display = "none";
        return;
    }

    // Show the bar ONLY in the plain garage. Python pushes visible=false while a
    // tank-setup / ammo loadout overlay is open (the params panel stays mounted to
    // show stat changes, so the bar would otherwise linger over it). An absent flag
    // (older Python build) is treated as visible -- fail open.
    if (data.visible === false) {
        root.style.display = "none";
        return;
    }
    root.style.display = "";

    // Elite Levels (prestige) modes own the whole header + bar (grade/reward
    // readout, single-segment fill, combat-XP star), so they branch out early.
    if (data.mode === "elite" || data.mode === "elite_rewards") {
        renderElite(root, data, data.mode === "elite_rewards");
        return;
    }

    // The label-side counter is removed for the non-elite modes (tech-tree /
    // field-mods / skill-tree) -- hide it here. The elite branch (renderElite)
    // owns this slot for its own LVL n/m readout and isn't reached from here.
    setUpgrades(upgradesEl, 0, 0);
    // Right-side readout stays visible in every mode (set per-mode below).
    xpEl.style.display = "flex";

    const mode = data.mode;
    const sMin = data.scaleMin || 0;
    const sMax = data.scaleMax || 0;
    const fv = data.fillVehicle || 0;
    const ff = data.fillFree || 0;
    const span = Math.max(sMax - sMin, 1);
    const pct = (xp) => Math.max(0, Math.min(100, ((xp - sMin) / span) * 100));

    // Right-side readout: skill-tree shows the unlocked/total node COUNT fronted by
    // the Upgrades-screen counter glyph; every other mode (incl. COMPLETE below)
    // shows spendable Total XP.
    if (mode === "skill_tree") {
        root.querySelector(".wg-xp-ico").style.backgroundImage =
            "url('" + SKILL_COUNTER_ICON + "')";
        root.querySelector(".wg-xp-val").textContent =
            (data.fieldModsDone || 0) + "/" + (data.fieldModsTotal || 0);
    } else {
        setXp(root, data.fillVehicle, data.fillFree);
    }

    const vehEl = root.querySelector(".wg-fill-veh");
    const freeEl = root.querySelector(".wg-fill-free");
    const ticksEl = root.querySelector(".wg-ticks");
    const tipEl = root.querySelector(".wg-tooltip");
    const hotEl = root.querySelector(".wg-hot");
    // Hover lives on a dedicated transparent overlay (.wg-hot), the only element
    // we re-enable pointer-events on (root stays pointer-events:none so it never
    // steals hangar drag-to-rotate). It's sized in CSS to span the bar AND the
    // glyphs below it, so hovering an icon registers too.
    ensureHover(hotEl, tipEl);
    hotEl._wgMode = mode;   // gates the tick-hover proximity (skill_tree only)
    // Tier-XI available-upgrade chips: render the visuals + register their hit-zones
    // on .wg-hot (which owns pointer events). Rebuild ONLY when the upgrade set
    // changes, so a hovered chip's tooltip isn't wiped by background pushes.
    if (mode === "skill_tree" && nextEl) {
        const sig = upgradesSig(data.availUpgrades);
        if (nextEl._wgSig !== sig) {
            nextEl._wgSig = sig;
            setActiveChip(hotEl, null);
            renderNextAvailable(nextEl, data.availUpgrades, hotEl);
        } else {
            nextEl.style.display = "flex";   // unchanged -> keep chips + tooltip, re-show
        }
    } else {
        nextEl._wgSig = null;
        hotEl._wgChips = [];
        setActiveChip(hotEl, null);
    }
    // NB: do NOT hide the tooltip here. render() runs on every model update
    // (which can fire while the cursor sits still over the bar); force-hiding it
    // each render made the tip vanish whenever the cursor stopped moving. The
    // hover handler owns visibility -- it re-reads the (rebuilt) tick metadata
    // below, so an in-place refresh just updates the data under the cursor.

    if (mode === "complete" || sMax <= sMin) {
        root.className = "wg-complete";
        label.textContent = "Fully researched";
        setCatIcon(catIcon, eliteIcon(data.vehicleClass));  // class + elite badge
        vehEl.style.left = "0%";
        vehEl.style.width = "100%";
        freeEl.style.width = "0%";
        ticksEl.innerHTML = "";   // no ticks -> nothing to hover
        hotEl._wgTickMeta = [];
        hotEl._wgClickMeta = [];
        tipEl.style.display = "none";
        return;
    }
    // Tier-XI skill-tree mode: a COUNT bar (axis = total upgrade nodes, fill =
    // nodes unlocked), with one evenly-spaced tick per node -- bright left of the
    // fill (unlocked), dim to the right (locked) -- and the signature 'final'
    // upgrade carrying its icon on the rightmost tick. No per-node tooltips (the
    // tick loop below skips hover wiring for this mode). wg-skill gives the fill its
    // own steel-blue tone (.wg-skill .wg-fill-veh in CSS), distinct from tech-tree.
    root.className = mode === "skill_tree" ? "wg-skill" : "";

    label.textContent = mode === "skill_tree" ? "Upgrades"
        : mode === "field_mods" ? "Field Modifications" : "Research";
    setCatIcon(catIcon, CAT_ICON[mode] || "");

    const vehW = pct(sMin + fv);
    const freeW = Math.max(0, pct(sMin + fv + ff) - vehW);
    vehEl.style.left = "0%";
    vehEl.style.width = vehW + "%";
    freeEl.style.left = vehW + "%";
    freeEl.style.width = freeW + "%";

    ticksEl.innerHTML = "";
    const ticks = data.ticks;
    const n = arrLen(ticks);
    // Skill-tree ticks carry no per-node metadata (non-linear tree) -> no hover
    // tooltips. Other modes wire each tick into the hover system.
    const noTips = mode === "skill_tree";
    // {left%, body} per tick, for the nearest-by-x hover fallback.
    const tickMeta = [];
    // {left%, cmd, arg} per CLICKABLE tick, for nearest-by-x click resolution.
    const clickMeta = [];
    // Field mods unlock linearly (one by one), so only the NEXT one -- the first
    // remaining tick -- is ever clickable. Consumed on the first fieldmod seen.
    let nextFieldMod = true;
    for (let i = 0; i < n; i++) {
        const t = unwrap(ticks[i] !== undefined ? ticks[i] : ticks.get && ticks.get(i));
        if (!t) continue;
        const mark = document.createElement("div");
        mark.className =
            "wg-tick wg-cat-" + (t.category || "x") +
            (t.locked ? " wg-locked" : t.affordable ? " wg-aff" : "");
        const leftPct = pct(t.position);
        mark.style.left = leftPct + "%";
        // Skill-tree count ticks carry no metadata, but the FINAL tick has a name
        // (+ cost) -> give it a hover tooltip too. Other modes: all ticks tip.
        if (!noTips || t.name) {
            const body = tooltipHtml(t);
            // Tag the tick (and, via ancestry, its glyph) so the handler can read
            // the exact tick under the cursor when Gameface deep-targets; also keep
            // a flat list for the nearest-by-x fallback when it doesn't.
            mark._wgBody = body;
            mark._wgLeft = leftPct;
            tickMeta.push({ left: leftPct, body: body });
        }

        // Clickability -> the reverse-channel command a click fires:
        //  - skill-tree: only the final tick (the one carrying the icon) opens
        //    WG's skill-tree screen (nodes carry no per-node identity to unlock).
        //  - field-mod: LINEAR -> only the next (first remaining) tick is a
        //    candidate; if affordable, unlock it (a choice-pair level opens the
        //    screen since a click can't pick a variant).
        //  - tech-tree (vehicle/module): affordable + prereqs met -> research it.
        let cmd = null, arg;
        if (mode === "skill_tree") {
            if (t.icon) cmd = "openSkillTree";
        } else if (t.category === "fieldmod") {
            if (nextFieldMod) {
                nextFieldMod = false;   // only the next field mod is ever clickable
                // WG's research dialog handles the step (incl. choice-pair levels).
                if (t.affordable && t.actionId) { cmd = "unlockFieldMod"; arg = t.actionId; }
            }
        } else if ((t.category === "vehicle" || t.category === "module")
                   && t.affordable && !t.locked && t.actionId) {
            cmd = "researchUnlock"; arg = t.actionId;
        }
        if (cmd) {
            mark.classList.add("wg-clickable");
            clickMeta.push({ left: leftPct, cmd: cmd, arg: arg });
        }

        if (t.category === "fieldmod") {
            // Field-mod ticks: a hexagon glyph with the level roman numeral
            // (mirrors the in-game field-modification level badges).
            const hex = document.createElement("div");
            hex.className = "wg-tick-hex";
            const num = document.createElement("span");
            num.textContent = romanize(t.level);
            hex.appendChild(num);
            mark.appendChild(hex);
        } else if (t.icon && mode === "skill_tree") {
            // Skill-tree FINAL upgrade: a framed perk glyph (diamond -- it's a major
            // 25k node) hung below the rightmost tick, matching the Next-available
            // chips. Reuses the chip frame/glyph classes.
            const fin = document.createElement("div");
            fin.className = "wg-final wg-chip-major";
            const frame = document.createElement("div");
            frame.className = "wg-chip-frame";
            const ico = document.createElement("div");
            ico.className = "wg-chip-ico";
            ico.style.backgroundImage = "url('" + t.icon + "')";
            fin.appendChild(frame);
            fin.appendChild(ico);
            mark.appendChild(fin);
        } else if (t.icon) {
            // Tech-tree ticks: the real in-game art (module-type glyph / framed
            // vehicle icon) as an img:// URL. Rendered as a background-image (not
            // <img>): Gameface honors background-size:contain for aspect-correct
            // scaling, whereas it clips an <img>. A URL that fails just renders
            // nothing (graceful).
            const img = document.createElement("div");
            img.className = "wg-tick-img";
            img.style.backgroundImage = "url('" + t.icon + "')";
            mark.appendChild(img);
        }
        ticksEl.appendChild(mark);
    }
    hotEl._wgTickMeta = tickMeta;
    hotEl._wgClickMeta = clickMeta;
}

// Tooltip body for an elite mark: the grade/reward name, (rewards) the reward
// type, and the elite level the mark sits at.
function eliteTooltipHtml(t, isRewards) {
    let html = "";
    const name = t.name || (isRewards ? "Reward" : "");
    if (name) html += '<div class="wg-tip-name">' + escapeHtml(name) + "</div>";
    // XP "cost": the cumulative combat XP needed to reach this elite level --
    // makes the level number meaningful. Shown in the currency-tan XP style.
    const xp = t.xpRequired | 0;
    if (xp > 0) html += '<div class="wg-tip-xp">' + fmtXp(xp) + " XP</div>";
    // status line: "<reward type> · " (rewards only) + the elite level.
    let status = "Elite Level " + (t.position | 0);
    if (isRewards) {
        const opts = (t.options || "").split("\n").filter(function (s) { return s; });
        if (opts.length) status = escapeHtml(opts[0]) + " · " + status;
    }
    html += '<div class="wg-tip-status">' + status + "</div>";
    return html;
}

// Render the ELITE (grade band) / ELITE_REWARDS (reward roadmap) views. Reuses
// the bar's track + hover overlay but with a single fill segment, a combat-XP
// readout, an "Elite Lvl N/350" counter, and grade-pip / reward-thumbnail ticks.
function renderElite(root, data, isRewards) {
    root.className = "wg-elite" + (isRewards ? " wg-elite-rewards" : "");
    const label = root.querySelector(".wg-label");
    const catIcon = root.querySelector(".wg-cat-icon");
    const upgradesEl = root.querySelector(".wg-upgrades");
    const xpEl = root.querySelector(".wg-xp");
    const vehEl = root.querySelector(".wg-fill-veh");
    const freeEl = root.querySelector(".wg-fill-free");
    const ticksEl = root.querySelector(".wg-ticks");
    const tipEl = root.querySelector(".wg-tooltip");
    const hotEl = root.querySelector(".wg-hot");
    ensureHover(hotEl, tipEl);
    hotEl._wgMode = data.mode;   // elite/elite_rewards -> nearest-anywhere tick hover
    hotEl._wgChips = [];         // no upgrade chips in elite modes

    // Header: title (grade family / "EXCLUSIVE REWARDS"), the Elite-level
    // counter, the class+elite badge, and the combat-XP readout.
    const grade = data.eliteGrade || "";
    const gradeName = grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : "";
    label.textContent = isRewards
        ? "EXCLUSIVE REWARDS"
        : ("Elite System" + (gradeName ? " " + gradeName : ""));
    const lvl = data.eliteLevel | 0;
    const maxLvl = data.eliteMaxLevel | 0;
    upgradesEl.textContent = "LVL " + lvl + (maxLvl ? "/" + maxLvl : "");
    upgradesEl.style.display = "block";
    setCatIcon(catIcon, eliteIcon(data.vehicleClass));
    xpEl.style.display = "flex";
    root.querySelector(".wg-xp-ico").style.backgroundImage = "url('" + COMBAT_XP_ICON + "')";
    root.querySelector(".wg-xp-val").textContent = fmtXp(data.combatXp || 0, ",");

    // Single-segment fill across the band/roadmap axis.
    const sMin = data.scaleMin || 0;
    const sMax = data.scaleMax || 0;
    const span = Math.max(sMax - sMin, 1);
    const pct = (x) => Math.max(0, Math.min(100, ((x - sMin) / span) * 100));
    const fillPos = sMin + (data.fillVehicle || 0);
    vehEl.style.left = "0%";
    vehEl.style.width = pct(fillPos) + "%";
    freeEl.style.left = "0%";
    freeEl.style.width = "0%";

    // Milestone ticks: grade sub-pips, or reward thumbnails ringed by state.
    ticksEl.innerHTML = "";
    const ticks = data.ticks;
    const n = arrLen(ticks);
    const tickMeta = [];
    for (let i = 0; i < n; i++) {
        const t = unwrap(ticks[i] !== undefined ? ticks[i] : ticks.get && ticks.get(i));
        if (!t) continue;
        const state = t.state || "upcoming";
        const mark = document.createElement("div");
        mark.className = "wg-tick wg-elite-tick wg-state-" + state;
        const leftPct = pct(t.position);
        mark.style.left = leftPct + "%";
        const body = eliteTooltipHtml(t, isRewards);
        mark._wgBody = body;
        mark._wgLeft = leftPct;
        tickMeta.push({ left: leftPct, body: body });

        const gradeFam = isRewards ? "" : gradeFamily(t.icon);
        if (t.icon) {
            // ELITE_REWARDS -> reward art thumbnail. ELITE -> the prestige HEXAGON
            // EMBLEM: the exact badge the hangar carousel vehicle tooltip shows. The
            // emblem PNG is solid art, drawn once (no stacking) so it reads opaque on
            // the hangar; the level number is a row of grade-colored emblemFont digit
            // glyphs (like the tooltip's PrestigeProgressLabel). The terminal MAX
            // "prestige" tick has no grade family, so it shows the gold hexagon
            // numberless -- matching the in-game MAX badge. All are state-treated
            // background-image divs (Gameface clips an <img>).
            const img = document.createElement("div");
            img.className = isRewards
                ? "wg-tick-reward"
                : ("wg-tick-emblem" + (gradeFam ? " wg-grade-" + gradeFam : ""));
            img.style.backgroundImage = "url('" + t.icon + "')";
            if (!isRewards && gradeFam) {
                img.appendChild(emblemNumber(t.position | 0, gradeFam));
            }
            mark.appendChild(img);
        } else {
            // fallback (icon URL missing): a state-colored diamond.
            const pip = document.createElement("div");
            pip.className = "wg-tick-pip";
            mark.appendChild(pip);
        }
        ticksEl.appendChild(mark);
    }
    hotEl._wgTickMeta = tickMeta;
    hotEl._wgClickMeta = [];   // elite grade/reward marks aren't clickable
    // Don't force-hide the tooltip here (render() re-runs on model updates); the
    // hover handler owns visibility, same as the main bar.
}

// Attach the hover handler to the ticks layer exactly once. That layer is the
// only element we re-enable pointer-events on (the root stays
// pointer-events:none so it never steals hangar drag-to-rotate) and is extended
// in CSS to span the bar AND the glyphs below it. Resolve the hovered tick two
// ways: (1) the exact element under the cursor (works when hovering a glyph,
// whose ancestor .wg-tick carries the body); (2) otherwise the nearest tick by
// cursor x (when hovering bare bar, where e.target is the layer itself).
function ensureHover(hotEl, tipEl) {
    if (hotEl._wgHoverBound) return;
    hotEl._wgHoverBound = true;
    const show = (body, leftPct) => {
        tipEl.innerHTML = body;
        tipEl.style.left = leftPct + "%";
        tipEl.style.display = "block";
    };
    hotEl.addEventListener("mousemove", function (e) {
        // Tier-XI "Next available:" chips first (they own a framed tooltip + click,
        // hit-tested here since they can't receive events themselves).
        const chip = chipAt(hotEl, e.clientX, e.clientY);
        if (chip) {
            setActiveChip(hotEl, chip);
            tipEl.style.display = "none";
            hotEl.style.cursor = "pointer";
            return;
        }
        setActiveChip(hotEl, null);
        // Pointer affordance: a pointer cursor only while over a clickable tick.
        hotEl.style.cursor = nearestClick(hotEl, e.clientX) ? "pointer" : "";
        // (1) exact element under the cursor.
        let node = e.target;
        while (node && node !== hotEl) {
            if (node._wgBody !== undefined) { show(node._wgBody, node._wgLeft); return; }
            node = node.parentElement;
        }
        // (2) nearest tick by cursor x.
        const meta = hotEl._wgTickMeta;
        if (!meta || !meta.length) { tipEl.style.display = "none"; return; }
        const rect = hotEl.getBoundingClientRect();
        const w = (rect && rect.width) || hotEl.clientWidth || 1;
        const left = rect ? rect.left : 0;
        const curPct = ((e.clientX - left) / w) * 100;
        let best = null, bestD = 1e9;
        for (let i = 0; i < meta.length; i++) {
            const d = Math.abs(meta[i].left - curPct);
            if (d < bestD) { bestD = d; best = meta[i]; }
        }
        // In skill_tree mode the only tooltip-tick is the final upgrade (far right);
        // gate it by proximity so it doesn't show across the whole empty bar. Other
        // modes keep nearest-anywhere (dense ticks make that the right behavior).
        const ok = best && (hotEl._wgMode !== "skill_tree" || bestD <= 6);
        if (ok) show(best.body, best.left); else tipEl.style.display = "none";
    });
    hotEl.addEventListener("mouseleave", function () {
        setActiveChip(hotEl, null);
        tipEl.style.display = "none";
    });
    // Click -> a Tier-XI chip (exact box hit) first, else the nearest clickable tick
    // (proximity-gated, with WG's confirm dialog backstopping any imprecise hit).
    hotEl.addEventListener("click", function (e) {
        const chip = chipAt(hotEl, e.clientX, e.clientY);
        if (chip) { invokeCommand(chip.cmd, chip.arg); return; }
        const hit = nearestClick(hotEl, e.clientX);
        if (hit) invokeCommand(hit.cmd, hit.arg);
    });
}

engine.whenReady.then(() => {
    observer.onUpdate(render);
    observer.subscribe();
    render(observer.model);
});
