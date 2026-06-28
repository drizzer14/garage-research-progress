# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t
from wgmod_research.domain.resolvers import elite


def test_milestones_remaining_only_against_earned():
    snap = t.VehicleSnapshot(
        tier=11, is_elite=True, vehicle_xp=0, free_xp=999999,  # free XP must NOT count
        elite_earned_xp=15000, elite_cap_level=150,
        elite_milestones=[t.Milestone(10, 10000, "Bronze", "b.png"),   # reached (<=15000)
                          t.Milestone(50, 50000, "Silver", "s.png"),
                          t.Milestone(150, 200000, "Gold", "g.png")])
    ticks = elite.resolve(snap)
    # 10000 already reached -> excluded; remaining 50000, 200000
    assert [tk.xp_position for tk in ticks] == [50000, 200000]
    assert all(tk.category == "elite" for tk in ticks)
    # earned 15000 affords neither -> not affordable (free XP ignored)
    assert [tk.affordable for tk in ticks] == [False, False]
