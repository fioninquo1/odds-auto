import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { candidates } from './candidates.mjs';
import { fetchOdds as fetchBetLabel } from './sources/betlabel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(ROOT, 'odds.json');

function gitPush() {
  try {
    const status = execSync('git diff --quiet odds.json', { cwd: ROOT }).toString();
    console.log('odds.json unchanged, skipping push.');
    return;
  } catch {
    // diff --quiet exits 1 when there are changes — that's what we want
  }
  execSync('git add odds.json', { cwd: ROOT });
  const msg = `Update odds ${new Date().toISOString()}`;
  execSync(`git commit -m "${msg}"`, { cwd: ROOT });
  execSync('git push', { cwd: ROOT });
  console.log('Pushed to GitHub.');
}

async function main() {
  try {
    console.log('Fetching odds from BetLabel...');
    const odds = await fetchBetLabel();
    console.log('BetLabel OK:', odds);

    const output = {
      updatedAt: new Date().toISOString(),
      source: 'betlabel',
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        party: c.party,
        odds: odds[c.id] ?? null,
      })),
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
    console.log(`Written to ${OUTPUT_PATH}`);

    gitPush();
  } catch (e) {
    console.error('BetLabel failed:', e.message);
    console.log('Keeping existing odds.json unchanged.');
    process.exit(0);
  }
}

main();
