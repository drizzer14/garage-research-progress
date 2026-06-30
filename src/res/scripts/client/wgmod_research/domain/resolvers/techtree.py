# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t


def resolve(snapshot):
    """Return tech-tree ticks ordered by cumulative XP cost (remaining only)."""
    spendable = snapshot.vehicle_xp + snapshot.free_xp
    remaining = [u for u in snapshot.tech_unlocks if not u.researched]
    remaining.sort(key=lambda u: u.xp_cost)
    ticks = []
    running = 0
    for u in remaining:
        running += u.xp_cost
        # category carries the unlock kind ('vehicle' | 'module') so the view can
        # draw a distinct glyph for the next-tank tick vs module ticks.
        ticks.append(t.Tick(
            xp_position=running, category=u.kind, icon=u.icon, name=u.name,
            xp_gained=0, xp_required=u.xp_cost,
            affordable=(running <= spendable), completed=False,
            locked=not u.prereqs_met, action_id=u.int_cd))
    return ticks
