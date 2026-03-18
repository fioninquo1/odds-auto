import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidates } from './candidates.mjs';
import { fetchOdds as fetchBetLabel } from './sources/betlabel.mjs';
import { fetchOdds as fetchPolymarket } from './sources/polymarket.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'odds.json');

async function main() {
  let odds = null;
  let source = null;

  // Try BetLabel first
  try {
    console.log('Fetching odds from BetLabel...');
    odds = await fetchBetLabel();
    source = 'betlabel';
    console.log('BetLabel OK:', odds);
  } catch (e) {
    console.warn('BetLabel failed:', e.message);
  }

  // Fallback to Polymarket
  if (!odds) {
    try {
      console.log('Fetching odds from Polymarket...');
      odds = await fetchPolymarket();
      source = 'polymarket';
      console.log('Polymarket OK:', odds);
    } catch (e) {
      console.error('Polymarket failed:', e.message);
    }
  }

  if (!odds) {
    console.error('All sources failed. Exiting.');
    process.exit(1);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party,
      odds: odds[c.id] ?? null,
    })),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Written to ${OUTPUT_PATH}`);
}

main();
