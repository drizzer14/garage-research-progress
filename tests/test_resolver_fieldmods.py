# -*- coding: utf-8 -*-
from wgmod_research.domain import types as t
from wgmod_research.domain.resolvers import fieldmods


def _step(sid, cost, unlocked=False):
    return t.ProgressionStep(step_id=sid, name="fm%d" % sid, icon="fm%d.png" % sid,
                             xp_cost=cost, unlocked=unlocked)


def test_orders_by_step_sequence_cumulatively_skipping_unlocked():
    snap = t.VehicleSnapshot(
        tier=9, is_elite=True, vehicle_xp=3000, free_xp=0,  # spendable 3000
        field_mod_steps=[_step(1, 1000, unlocked=True),
                         _step(2, 2000),
                         _step(3, 4000)])
    ticks = fieldmods.resolve(snap)
    assert [tk.xp_required for tk in ticks] == [2000, 4000]
    assert [tk.xp_position for tk in ticks] == [2000, 6000]
    assert [tk.affordable for tk in ticks] == [True, False]
    assert all(tk.category == "fieldmod" for tk in ticks)


def test_start_position_offsets_cumulative_positions():
    snap = t.VehicleSnapshot(
        tier=9, is_elite=True, vehicle_xp=10000, free_xp=0,
        field_mod_steps=[_step(1, 2000), _step(2, 4000)])
    ticks = fieldmods.resolve(snap, start_position=500)
    # cumulative from 500: 2500, then 6500
    assert [tk.xp_position for tk in ticks] == [2500, 6500]
