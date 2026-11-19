// Sunport Heat — the hand-in step (Node 22, standard library only).
//
// The game itself is plain static files under game/: index.html plus its ES
// modules, no build step, no network request, so any static server can host
// it. This script is the only moving part: it gathers game/ and the four
// screenshots/ into the output directory and writes dossier.json, the
// summary the judge reads, using the vendored make.fun library.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR pointing at a scratch
// directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives, and where the hand-in goes.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from reference/gate.json: the dossier text budget is
// the only one that shapes the bytes; the rest refuse an entry the scorer
// would refuse anyway (too many or too large screenshots, too many or too
// large game files, or a game path that is too long).
const dossierLimits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(source, target) {
  if (!existsSync(source)) return;
  cpSync(source, target, { recursive: true });
}

mkdirSync(destDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(destDir, 'game'));
mkdirSync(join(destDir, 'screenshots'), { recursive: true });
copyTree(join(repoRoot, 'screenshots'), join(destDir, 'screenshots'));

const dossier = buildDossier(destDir, dossierLimits);
writeFileSync(join(destDir, 'dossier.json'), dossier);
