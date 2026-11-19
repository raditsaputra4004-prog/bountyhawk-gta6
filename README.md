# Sunport Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/raditsaputra4004-prog/bountyhawk-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/raditsaputra4004-prog/bountyhawk-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Everything here
is our own: the city of Sunport, its people, its cars, its story, its art
and its sounds. Nothing is taken from any commercial game.

## The game

Rex Vane is back in Sunport and owes crew boss Mara Quinn $50,000. Work the
five-job story chain to clear the debt — or just cruise the city, steal cars,
dodge the Sunport police, and take taxi fares for cash.

- **A city to explore** — 3600×3600 open world, 9×9 road grid, 7 districts,
  parks, a beach and a bay, 12 named places.
- **On foot and by car** — arcade driving with grip, slide and handbrake;
  7 car models, 26 traffic cars, 14 parked cars to steal, 34 pedestrians.
- **Wanted level and police** — 0–5 stars. Steal, hit, shoot and the heat
  rises; cruisers chase and ram, foot cops chase and bust.
- **Missions and a story** — 5 jobs with timers, chases and armed guards,
  plus repeatable taxi fares with speed tips.
- **Combat** — punch and pistol, tracers, muzzle flash, explosions.
- **HUD with a live minimap**, objective arrow, mission timer, speedometer.
- **Start screen, pause menu and saving** — progress is kept in localStorage.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
file server — the game makes no network requests). Keyboard and mouse:

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| E | Enter or exit a car (steal a parked one) |
| F | Punch |
| Mouse + click | Aim and shoot the pistol |
| Space | Handbrake |
| Esc | Pause |
| M | Mute |

## Files

- `game/` — the game itself, static files with no build step.
- `screenshots/` — 4 screenshots of the game, taken by its maker.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` (run it with
  `MAKEFUN_OUTPUT_DIR=out node main.ts`).

Built with make.fun — referral code `2yq7mcmp`
(https://make.fun/r/2yq7mcmp).
