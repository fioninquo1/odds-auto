import { chromium } from 'playwright';
import { playerIdMap } from '../candidates.mjs';

const PAGE_URL =
  'https://betlbl.com/hu/line/polybet/2932880-politics-hungary/312423938-next-prime-minister-of-hungary';

const WINNER_MARKET_TYPE = 396;

export async function fetchOdds() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'hu-HU',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for the SPA to populate the game state
    await page.waitForFunction(
      () => {
        const app = window.__BETTING_APP__;
        const game = app?.pinia?.game;
        return game?.unparsedMarketGroupsByGameId &&
          Object.keys(game.unparsedMarketGroupsByGameId).length > 0;
      },
      { timeout: 15000 }
    );

    const odds = await page.evaluate((config) => {
      const { playerIdMap, WINNER_MARKET_TYPE } = config;
      const game = window.__BETTING_APP__.pinia.game;
      const knownPlayerIds = new Set(Object.keys(playerIdMap).map(Number));
      let outcomes = null;

      for (const gameId of Object.keys(game.unparsedMarketGroupsByGameId)) {
        const groups = game.unparsedMarketGroupsByGameId[gameId];
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
          if (!Array.isArray(group.E)) continue;
          for (const marketOutcomes of group.E) {
            if (!Array.isArray(marketOutcomes)) continue;
            if (marketOutcomes.some((o) => o.PL && knownPlayerIds.has(o.PL.I) && o.T === WINNER_MARKET_TYPE)) {
              outcomes = marketOutcomes;
              break;
            }
          }
          if (outcomes) break;
        }
        if (outcomes) break;
      }

      if (!outcomes) throw new Error('Winner market not found');

      const result = {};
      for (const o of outcomes) {
        if (!o.PL || o.T !== WINNER_MARKET_TYPE) continue;
        const candidateId = playerIdMap[o.PL.I];
        if (candidateId) result[candidateId] = o.C;
      }
      return result;
    }, { playerIdMap, WINNER_MARKET_TYPE });

    if (Object.keys(odds).length === 0) {
      throw new Error('No matching candidates found');
    }

    return odds;
  } finally {
    await browser.close();
  }
}
