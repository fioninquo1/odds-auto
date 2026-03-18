# Odds Auto – Működés és setup

## Hogyan működik most

1. **Systemd timer** óránként futtatja a scrapert a lokális gépen (`akos-cachy`)
2. A scraper lekéri a BetLabel oldalt, kiolvassa az SSR adatból az oddsokat
3. Ha változtak, commitol és pushol a GitHub repóba (`fioninquo1/odds-auto`)
4. **GitHub Pages** automatikusan kiszolgálja az `odds.json`-t: `https://fioninquo1.github.io/odds-auto/odds.json`
5. A Mautic landing page `<script>` blokkja fetch-eli ezt a JSON-t és frissíti a DOM-ot

## Fájlok

- `scraper/sources/betlabel.mjs` — BetLabel SSR parse (fetch + Node.js vm)
- `scraper/index.mjs` — orchestrator, odds.json írás, git push
- `scraper/candidates.mjs` — a 6 jelölt adatai
- `.github/workflows/deploy-pages.yml` — GitHub Pages deploy (push-ra triggerel)
- `landing.html` — a landing page a `<script>` snippet-tel (gitignore-ban van, Mautic-ba kell másolni)
- `odds.json` — a scraper outputja, ez az "API"

## Hasznos parancsok

```bash
# Timer állapot
systemctl --user status odds-scraper.timer

# Kézi futtatás
systemctl --user start odds-scraper.service

# Logok
journalctl --user -u odds-scraper.service

# Timer leállítás
systemctl --user stop odds-scraper.timer

# Timer újraindítás
systemctl --user restart odds-scraper.timer
```

## Ismert limitáció

A BetLabel blokkolja a datacenter IP-ket (GitHub Actions, Cloudflare Workers stb.), ezért a scraper csak "normál" IP-ről fut — jelenleg a lokális gépről. Ha a gép ki van kapcsolva, nem frissül az odds.json, de a landing page ilyenkor is a legutóbbi adatot mutatja.

---

## Későbbi fejlesztés: proxy megoldás (szerverre költöztetés)

Ha a scraper-t szerverre (pl. Raspi, VPS) akarod költöztetni, két útvonal van:

### A) Cloudflare Worker proxy

1. Cloudflare Worker-t deployolsz, ami proxy-ként lekéri a BetLabel HTML-t
2. A scraper a Worker URL-t hívja a BetLabel közvetlen URL helyett
3. Így a scraper futhat GitHub Actions-ből is (a Worker edge IP-ről fetchel, amit nem blokkol a BetLabel)

**worker/index.js:**
```js
const TARGET_URL = 'https://betlbl.com/hu/line/polybet/2932880-politics-hungary/312423938-next-prime-minister-of-hungary';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== 'TITKOS_KULCS') {
      return new Response('Forbidden', { status: 403 });
    }
    const res = await fetch(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'hu-HU,hu;q=0.9',
      },
      redirect: 'follow',
    });
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
```

**Deploy:** `npx wrangler deploy` (Cloudflare email verifikáció kell hozzá)

Utána a `betlabel.mjs`-ben a `PAGE_URL`-t cseréld a Worker URL-re:
```js
const PAGE_URL = 'https://betlabel-proxy.ACCOUNTNEV.workers.dev/?key=TITKOS_KULCS';
```

Visszarakod a `update-odds.yml` GitHub Actions workflow-t, és kész — teljesen automatikus, szerver nélkül.

### B) Raspi / VPS

1. Klónold a repót a szerverre
2. Állítsd be a git auth-ot (`gh auth login` vagy SSH key)
3. Másold a systemd fájlokat:
   - `~/.config/systemd/user/odds-scraper.service`
   - `~/.config/systemd/user/odds-scraper.timer`
4. `systemctl --user enable --now odds-scraper.timer`
5. Lokális gépről a timer-t kikapcsolod: `systemctl --user disable --now odds-scraper.timer`
