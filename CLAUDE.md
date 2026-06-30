# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

World of Tanks **EU 2.3.0.1** Garage mod (`com.14th_ua.garageprogressbar`) — a progress bar
showing the selected vehicle's tech-tree research, Field Modifications, tier-XI
skill-tree upgrades, and Elite Levels (prestige). Hard dependency: **OpenWG
GameFace**. Player-facing docs: `README.md`, `INSTALL.md`. WoT-modding background:
`RESEARCH.md`.

## The one rule that bites everywhere

The game runs compiled `.pyc`, and **bytecode is version-locked**: package with
**Python 2.7.18** (`C:\Python27\python.exe`) — Python 3 bytecode will NOT load.
Tests and dev tools run on **Python 3.13**. There is no npm/linter/CI; builds are
plain Python scripts.

## Task-scoped skills

Detailed, situational guidance lives in skills (loaded on demand to keep context
tight) — do not duplicate it here:
- **wgmod-build-deploy** — build the `.wotmod`, deploy locally, run pytest, hot-reload JS/CSS.
- **wgmod-release** — bump the version (7 files), tag, build installer, publish GH release.
- **wgmod-architecture** — the layered domain/adapter/bridge design, Python data flows, conventions (+ `references/game-api.md`).
- **wgmod-widget** — the Gameface HTML/CSS/JS widget: DOM, icon URLs, render branches, hover/click, CSS quirks.
- **wgmod-debug-repl** — live in-client TCP REPL introspection and dev-loop troubleshooting.
