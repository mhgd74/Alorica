#!/usr/bin/env node
/**
 * Installs the Git hook that keeps the compiled modules in src/ in step with
 * their .jsx sources.
 *
 * The compiled files are committed on purpose. Vercel serves this repository
 * from its root (vercel.json sets outputDirectory: "."), so anything the
 * browser loads has to be in the tree; the deploy cannot rely on producing it.
 * Vercel does re-run `npm run build` as a safety net, but the hook is what
 * stops the committed .js from drifting away from the .jsx it was generated
 * from between deploys.
 *
 * Run automatically by `npm install` through the "prepare" script. Outside a Git
 * checkout it does nothing, so installs from a tarball or in CI are unaffected.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, '.git', 'hooks');
const MARKER = 'Installed by scripts/install-hooks.js';

const HOOK = `#!/bin/sh
# ${MARKER} — do not edit by hand.
#
# Recompiles src/**/*.jsx and stages the result, so the .js committed alongside
# each .jsx is always the one that source produces. A failing build stops the
# commit rather than letting a half-translated module reach the browser.
node scripts/build.js || exit 1
git add src
`;

const main = () => {
  if (!fs.existsSync(HOOKS_DIR)) {
    console.log('install-hooks: no .git/hooks directory, skipping.');
    return;
  }

  const target = path.join(HOOKS_DIR, 'pre-commit');

  // Never clobber a hook somebody else put there.
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes(MARKER)) {
    console.warn(`install-hooks: ${target} already exists and is not ours — left untouched.`);
    return;
  }

  fs.writeFileSync(target, HOOK);
  try {
    fs.chmodSync(target, 0o755);
  } catch (e) {
    /* Windows has no executable bit; Git for Windows reads the shebang instead. */
  }
  console.log('install-hooks: wrote .git/hooks/pre-commit');
};

main();
