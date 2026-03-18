import { candidates } from '../candidates.mjs';

const EVENT_URL =
  'https://gamma-api.polymarket.com/events?slug=next-prime-minister-of-hungary';

export async function fetchOdds() {
  const res = await fetch(EVENT_URL);

  if (!res.ok) {
    throw new Error(`Polymarket responded with ${res.status}`);
  }

  const events = await res.json();
  const event = Array.isArray(events) ? events[0] : events;

  if (!event?.markets?.length) {
    throw new Error('No markets found in Polymarket event');
  }

  // Build a lookup: lowercase outcome name -> probability
  const probabilities = {};
  for (const market of event.markets) {
    const name = (market.groupItemTitle || market.question || '').toLowerCase();
    let prices;
    try { prices = JSON.parse(market.outcomePrices); } catch { prices = null; }
    const prob = parseFloat(prices?.[0] ?? market.lastTradePrice ?? 0);
    if (name && prob > 0) {
      probabilities[name] = prob;
    }
  }

  // Strip diacritics for matching (Polymarket uses accented Hungarian names)
  function normalize(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Match candidates by their polymarketName
  const odds = {};
  for (const candidate of candidates) {
    const searchName = normalize(candidate.polymarketName);
    // Try exact match first, then substring
    let prob = null;
    for (const [key, val] of Object.entries(probabilities)) {
      const normKey = normalize(key);
      if (normKey === searchName || normKey.includes(searchName) || searchName.includes(normKey)) {
        prob = val;
        break;
      }
    }
    if (prob && prob > 0) {
      // Convert probability to decimal odds, round to 2 decimals
      odds[candidate.id] = Math.round((1 / prob) * 100) / 100;
    }
  }

  if (Object.keys(odds).length === 0) {
    throw new Error('No matching candidates found in Polymarket data');
  }

  return odds;
}
