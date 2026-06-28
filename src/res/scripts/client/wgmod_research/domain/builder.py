# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t
from wgmod_research.domain.resolvers import techtree, fieldmods, tierxi, elite


def _max_pos(ticks, default):
    return max([tk.xp_position for tk in ticks]) if ticks else default


def build_model(snapshot):
    spendable = snapshot.vehicle_xp + snapshot.free_xp

    if snapshot.tier == 11:
        node_ticks = tierxi.resolve_nodes(snapshot)
        if node_ticks:
            return t.ResearchProgressModel(
                mode=t.Mode.TIERXI_NODES,
                scale_min=snapshot.tierxi_earned_xp,
                scale_max=_max_pos(node_ticks, snapshot.tierxi_earned_xp),
                fill_spendable=spendable, fill_earned=0, ticks=node_ticks)
        elite_ticks = elite.resolve(snapshot)
        return t.ResearchProgressModel(
            mode=t.Mode.ELITE_PLUS_TIERXI_REWARDS,
            scale_min=snapshot.elite_earned_xp,
            scale_max=_max_pos(elite_ticks, snapshot.elite_earned_xp),
            fill_spendable=0, fill_earned=snapshot.elite_earned_xp, ticks=elite_ticks)

    # tiers I-X
    if not snapshot.is_elite:
        ticks = techtree.resolve(snapshot)
        return t.ResearchProgressModel(
            mode=t.Mode.TECH_TREE, scale_min=0, scale_max=_max_pos(ticks, 0),
            fill_spendable=spendable, fill_earned=0, ticks=ticks)

    # elite tiers I-X: field mods + (real/potential) Tier XI successor
    fm_ticks = fieldmods.resolve(snapshot)
    fm_end = _max_pos(fm_ticks, 0)
    succ_ticks = tierxi.resolve_successor(snapshot, start_position=fm_end)
    research_ticks = fm_ticks + succ_ticks
    if research_ticks:
        return t.ResearchProgressModel(
            mode=t.Mode.RESEARCH_PLUS_TIERXI, scale_min=0,
            scale_max=_max_pos(research_ticks, 0),
            fill_spendable=spendable, fill_earned=0, ticks=research_ticks)

    elite_ticks = elite.resolve(snapshot)
    return t.ResearchProgressModel(
        mode=t.Mode.ELITE, scale_min=snapshot.elite_earned_xp,
        scale_max=_max_pos(elite_ticks, snapshot.elite_earned_xp),
        fill_spendable=0, fill_earned=snapshot.elite_earned_xp, ticks=elite_ticks)
