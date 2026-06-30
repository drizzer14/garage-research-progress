# -*- coding: utf-8 -*-
"""User settings, surfaced through ModsSettingsAPI (the community settings panel).

ModsSettingsAPI (izeberg.modssettingsapi, also shipped by Aslain's modpack) is an
OPTIONAL dependency: we import it guarded, and if it's absent the bar simply uses
the defaults (shown everywhere) with no settings panel -- never a crash. MSA owns
persistence, so there's no config file of our own.

Two independent "hide" checkboxes, both default OFF (bar shown):
- hideAlways       -- hide the whole widget on every vehicle (master switch).
- hideWhenComplete -- hide only on fully-progressed (Mode.COMPLETE) vehicles.

The visibility decision itself is the engine-free `builder.bar_visible`; this module
only owns the settings storage + the live-apply on change.
"""
from debug_utils import LOG_CURRENT_EXCEPTION, LOG_NOTE

# Our mod's reverse-domain id, reused as the MSA "linkage" (panel identity / storage key).
LINKAGE = "com.drizzer14.wgmod"

DEFAULTS = {"hideAlways": False, "hideWhenComplete": False}

# Current effective settings. Starts at defaults so accessors are always safe to call,
# even before init() runs or when MSA is absent.
_settings = dict(DEFAULTS)

# True once we've successfully registered with MSA. Kept so init() is idempotent AND
# self-healing: a failed attempt (MSA not loaded yet at our import time) leaves this
# False, so a later init() call (first hangar mount) retries until it sticks.
_registered = False


def _template():
    """The MSA panel descriptor. Two checkboxes, both defaulting to False so a fresh
    install shows the bar everywhere until the user opts to hide it."""
    return {
        "modDisplayName": "Research Progress Bar",
        "enabled": True,
        "column1": [
            {
                "type": "CheckBox",
                "text": "Hide the bar completely",
                "value": DEFAULTS["hideAlways"],
                "tooltip": ("{HEADER}Hide the bar completely{/HEADER}"
                            "{BODY}Hides the progress bar on every vehicle.{/BODY}"),
                "varName": "hideAlways",
            },
            {
                "type": "CheckBox",
                "text": "Hide when fully progressed",
                "value": DEFAULTS["hideWhenComplete"],
                "tooltip": ("{HEADER}Hide when fully progressed{/HEADER}"
                            "{BODY}Hides the bar only on vehicles with nothing left "
                            "to research, upgrade, or unlock.{/BODY}"),
                "varName": "hideWhenComplete",
            },
        ],
        "column2": [],
    }


def _apply(settings):
    """Merge an MSA settings dict into our cache, ignoring unknown/missing keys."""
    if not settings:
        return
    for key in DEFAULTS:
        if key in settings:
            _settings[key] = bool(settings[key])


def init():
    """Register (or re-load) our settings panel with ModsSettingsAPI.

    Idempotent and self-healing: a no-op once registered; otherwise re-attempts.
    MSA may load after us at startup, so the import can fail on the first call from
    the entry point -- we then retry on the first hangar mount (attach()), by which
    point every mod is loaded. Guarded so it never raises into the mount path."""
    global _registered
    if _registered:
        return
    try:
        from gui.modsSettingsApi import g_modsSettingsApi
    except ImportError:
        LOG_NOTE("[wgmod] ModsSettingsAPI not present -- using default visibility "
                 "(bar shown, no settings panel)")
        return
    try:
        template = _template()
        saved = g_modsSettingsApi.getModSettings(LINKAGE, template)
        if saved:
            _apply(saved)
            g_modsSettingsApi.registerCallback(LINKAGE, _on_changed)
        else:
            _apply(g_modsSettingsApi.setModTemplate(LINKAGE, template, _on_changed))
        _registered = True
        LOG_NOTE("[wgmod] ModsSettingsAPI registered: %s" % (_settings,))
    except Exception:
        LOG_CURRENT_EXCEPTION()


def _on_changed(linkage, new_settings):
    """MSA callback when the user toggles a checkbox. Update the cache and re-push
    the bar so the change applies live (refresh re-evaluates visibility)."""
    try:
        _apply(new_settings)
        LOG_NOTE("[wgmod] settings changed: %s" % (_settings,))
        # Lazy import to avoid an import cycle (the bridge imports this module).
        from wgmod_research.bridge import gameface_bridge as B
        B.refresh()
    except Exception:
        LOG_CURRENT_EXCEPTION()


def hide_always():
    return _settings["hideAlways"]


def hide_when_complete():
    return _settings["hideWhenComplete"]
