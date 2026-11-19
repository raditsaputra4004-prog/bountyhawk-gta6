# Sunport Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/raditsaputra4004-prog/bountyhawk-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/raditsaputra4004-prog/bountyhawk-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a complete 2D top-down city you can explore on foot and by car, with traffic, pedestrians, a wanted level, police chases, a five-mission story, combat, and a HUD with a minimap. Everything is invented for this game: the city of Sunport, Rex Vane, Mara Quinn, the cars, the art, the sounds, the music. Nothing comes from any commercial game.

Referral: `2yq7mcmp` — https://make.fun/r/2yq7mcmp

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` from any static server). No network request, no build step, no install.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Shift | Run |
| E | Get in / out of a car |
| Space | Handbrake |
| F | Punch |
| Mouse | Aim, click to shoot |
| Enter | Start the next mission |
| T | Take a taxi fare (near a hailing pedestrian) |
| Esc | Pause (save from here) |
| M | Mute |

## The story

Rex Vane is back in Sunport after three years away, and crew boss Mara Quinn owns his debt: **$50,000**. Five jobs pay it down — a reunion at the Neon Palms Club, a stolen sports car, a harbor drop under police heat, a jewel heist, and one last armored-van score. Between jobs, taxi fares pay the bills.

## Systems

- **The city** — a 3600×3600 seeded open world: nine-by-nine road grid, seven districts (Palmside, Old Town, Downtown towers, The Docks, Marina Bay, Eastside, North Hills), parks, a beach and a bay, and twelve named places.
- **Driving** — arcade physics with grip, slide and a handbrake; seven car models with different top speeds; traffic that follows the road graph and pauses at intersections.
- **Wanted level** — 0–5 stars. Stealing cars, hitting pedestrians, shooting and assaulting cops raise the heat; laying low lets it fade. Police cruisers chase and ram; foot cops chase, punch, and bust the player if they hold on.
- **Missions** — five story jobs with objectives, timers, a scripted escape, armed guards, and a marked armored van, plus repeatable taxi fares with speed tips.
- **Combat** — punching and a pistol with ammo, tracers, muzzle flash and hit reactions.
- **HUD** — health, cash, ammo, wanted stars, objective, mission timer, speedometer, and a live minimap with the player, police and mission marker.
- **Save** — progress (cash, health, mission, position) in `localStorage`, written on mission complete, fare payout and pause-menu save.
- **Sound** — all synthesized with WebAudio: effects, an engine drone that follows speed, and a bass loop. No audio files.
- **Screenshots** — `screenshots/` holds four real renders taken by playing the game in headless Chromium with deterministic staged scenes (`game/src/shots.js`, `?shot=<name>&seed=1337`).

## Layout

```
game/
  index.html            title / pause / wasted / busted screens (DOM) + canvas
  src/
    config.js           tuning, palette, city constants
    rng.js              seeded RNG (mulberry32)
    input.js            keyboard + mouse state
    city.js             road grid, buildings, districts, named places
    audio.js            synthesized WebAudio effects + music
    particles.js        sparks, smoke, floating text, skid marks
    vehicles.js         cars, arcade driving, traffic AI, parking
    peds.js             pedestrians, fleeing, taxi hailers
    police.js           wanted heat + police car / foot cop AI
    player.js           on-foot movement, punch, shoot, car entry
    missions.js         five-mission story chain + taxi fares
    render.js           city / entities / effects / HUD / minimap
    shots.js            deterministic screenshot staging + autopilot
    save.js             localStorage save / load
    main.js             world build, loop, state machine, wiring
main.ts                 hands game/ + screenshots/ in, writes dossier.json
screenshots/           01-cover, 02-mission, 03-street, 04-combat
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`. Running it twice writes identical bytes.
