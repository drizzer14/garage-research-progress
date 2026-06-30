# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t
from wgmod_research.domain.builder import bar_visible


def test_all_clear_is_visible():
    assert bar_visible(True, False, False, t.Mode.TECH_TREE) is True


def test_overlay_open_hides():
    # A tank-setup overlay is open (overlay_closed=False) -> hidden regardless of mode.
    assert bar_visible(False, False, False, t.Mode.TECH_TREE) is False


def test_hide_always_hides_any_mode():
    assert bar_visible(True, True, False, t.Mode.TECH_TREE) is False
    assert bar_visible(True, True, False, t.Mode.COMPLETE) is False
    # master switch wins even when the overlay is closed
    assert bar_visible(True, True, True, t.Mode.ELITE) is False


def test_hide_when_complete_hides_only_complete():
    assert bar_visible(True, False, True, t.Mode.COMPLETE) is False


def test_hide_when_complete_keeps_other_modes_visible():
    for mode in (t.Mode.TECH_TREE, t.Mode.FIELD_MODS, t.Mode.SKILL_TREE,
                 t.Mode.ELITE, t.Mode.ELITE_REWARDS):
        assert bar_visible(True, False, True, mode) is True
