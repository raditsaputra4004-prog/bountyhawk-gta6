// Sunport Heat — the entry program for the make.fun gta6-01 bounty.
//
// It hands the game in: it copies game/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with buildDossier
// from the kit's library (vendor/makefun-game.ts, unchanged). It runs twice
// with the same bytes out, uses the Node standard library only, and takes no
// network: outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repository root is the directory this file lives in.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier's caps, exactly as the bounty's gate sets them: the text cap,
// at most 4 screenshots of at most 256 KiB each, and game/'s own limits.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function clearOutputDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    const target = join(dir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
}

function copyEntryTree(): void {
  clearOutputDir(outDir);
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

function writeDossier(): void {
  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

copyEntryTree();
writeDossier();
console.log(`Sunport Heat handed in to ${outDir}`);
