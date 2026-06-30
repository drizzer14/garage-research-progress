# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t
from wgmod_research.domain.resolvers import skilltree


def _snap(is_skill_tree=True, total_xp=325000, spent_xp=130000, done=10,
          total=26, vehicle_xp=40000, free_xp=5000, final_icon="img://final.png"):
    return t.VehicleSnapshot(
        tier=10, is_elite=True, vehicle_xp=vehicle_xp, free_xp=free_xp,
        is_skill_tree=is_skill_tree, skilltree_total_xp=total_xp,
        skilltree_spent_xp=spent_xp, skilltree_done=done, skilltree_total=total,
        skilltree_final_icon=final_icon)


def test_not_skill_tree_returns_none():
    assert skilltree.resolve(_snap(is_skill_tree=False)) is None


def test_no_priced_nodes_returns_none():
    # A tree with no priced upgrade nodes -> nothing to show.
    assert skilltree.resolve(_snap(total=0)) is None


def test_fully_upgraded_returns_none():
    # Every node unlocked -> let the builder fall through to ELITE / COMPLETE.
    assert skilltree.resolve(_snap(done=26, total=26)) is None


def test_count_based_scale_and_fill():
    # Axis = node count, fill = nodes unlocked (NOT XP).
    res = skilltree.resolve(_snap(done=10, total=26))
    assert res["scale_min"] == 0
    assert res["scale_max"] == 26
    assert res["fill"] == 10
    assert res["done"] == 10
    assert res["total"] == 26


def test_one_evenly_spaced_tick_per_node():
    res = skilltree.resolve(_snap(done=10, total=26))
    ticks = res["ticks"]
    assert len(ticks) == 26
    # tick i sits at position i (1..total), evenly spaced on the 0..total axis.
    assert [tk.xp_position for tk in ticks] == list(range(1, 27))
    assert all(tk.category == "upgrade" for tk in ticks)


def test_tick_state_splits_at_done():
    # Unlocked nodes (i <= done) are affordable/completed; the rest are locked.
    res = skilltree.resolve(_snap(done=10, total=26))
    ticks = res["ticks"]
    for i, tk in enumerate(ticks, start=1):
        unlocked = i <= 10
        assert tk.affordable is unlocked
        assert tk.completed is unlocked
        assert tk.locked is (not unlocked)


def test_only_final_tick_carries_icon():
    res = skilltree.resolve(_snap(done=10, total=26, final_icon="img://final.png"))
    ticks = res["ticks"]
    assert ticks[-1].icon == "img://final.png"
    assert all(tk.icon == "" for tk in ticks[:-1])


def test_missing_final_icon_leaves_last_tick_iconless():
    res = skilltree.resolve(_snap(done=10, total=26, final_icon=""))
    assert res["ticks"][-1].icon == ""
