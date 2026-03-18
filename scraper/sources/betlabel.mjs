import vm from 'node:vm';
import { playerIdMap } from '../candidates.mjs';

const PAGE_URL =
  'https://betlbl.com/hu/line/polybet/2932880-politics-hungary/312423938-next-prime-minister-of-hungary';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const WINNER_MARKET_TYPE = 396;

export async function fetchOdds() {
  const res = await fetch(PAGE_URL, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`BetLabel responded with ${res.status}`);
  }

  const html = await res.text();

  // Step 1: Execute __V3_HOST_APP__ to get the codeToEval string
  const marker = 'window.__V3_HOST_APP__=';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('Could not find __V3_HOST_APP__ in BetLabel HTML');
  }
  const endIdx = html.indexOf('</script>', startIdx);
  const hostIife = html.substring(startIdx + marker.length, endIdx).trim();

  let hostApp;
  try {
    const sandbox = {};
    vm.runInNewContext(`result = ${hostIife}`, sandbox, { timeout: 5000 });
    hostApp = sandbox.result;
  } catch (e) {
    throw new Error(`Failed to execute __V3_HOST_APP__ IIFE: ${e.message}`);
  }

  // Step 2: Get the codeToEval from the betting app micro-frontend state
  const smfKey = Object.keys(hostApp.state || {}).find((k) => k.includes('betting-app'));
  const codeToEval = hostApp.state?.[smfKey]?.codeToEval;
  if (!codeToEval) {
    throw new Error('Could not find codeToEval in __V3_HOST_APP__ state');
  }

  // Step 3: Execute codeToEval — it assigns window.__BETTING_APP__
  let bettingApp;
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(codeToEval, sandbox, { timeout: 5000 });
    bettingApp = sandbox.window.__BETTING_APP__;
  } catch (e) {
    throw new Error(`Failed to execute __BETTING_APP__ codeToEval: ${e.message}`);
  }

  if (!bettingApp) {
    throw new Error('codeToEval did not produce __BETTING_APP__');
  }

  // Step 4: Navigate to game data
  const game = bettingApp?.pinia?.game ?? bettingApp?.state?.game;
  if (!game?.unparsedMarketGroupsByGameId) {
    throw new Error('Unexpected BetLabel state structure');
  }

  // Step 5: Find the winner market with our known player IDs
  const knownPlayerIds = new Set(Object.keys(playerIdMap).map(Number));
  let outcomes = null;

  for (const gameId of Object.keys(game.unparsedMarketGroupsByGameId)) {
    const groups = game.unparsedMarketGroupsByGameId[gameId];
    if (!Array.isArray(groups)) continue;

    for (const group of groups) {
      if (!Array.isArray(group.E)) continue;
      for (const marketOutcomes of group.E) {
        if (!Array.isArray(marketOutcomes)) continue;
        const hasKnownPlayer = marketOutcomes.some(
          (o) => o.PL && knownPlayerIds.has(o.PL.I) && o.T === WINNER_MARKET_TYPE
        );
        if (hasKnownPlayer) {
          outcomes = marketOutcomes;
          break;
        }
      }
      if (outcomes) break;
    }
    if (outcomes) break;
  }

  if (!outcomes) {
    throw new Error('Could not find Hungarian election winner market in BetLabel data');
  }

  const odds = {};
  for (const o of outcomes) {
    if (!o.PL || o.T !== WINNER_MARKET_TYPE) continue;
    const candidateId = playerIdMap[o.PL.I];
    if (candidateId) {
      odds[candidateId] = o.C;
    }
  }

  if (Object.keys(odds).length === 0) {
    throw new Error('No matching candidates found in BetLabel outcomes');
  }

  return odds;
}
