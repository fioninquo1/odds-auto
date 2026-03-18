import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidates } from './candidates.mjs';
import { fetchOdds as fetchBetLabel } from './sources/betlabel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'odds.json');

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
  } catch (e) {
    console.error('BetLabel failed:', e.message);
    console.log('Keeping existing odds.json unchanged.');
    process.exit(0);
  }
}

main();
