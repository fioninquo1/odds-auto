# Odds Auto – Működés és setup

## Hogyan működik most

1. **Raspberry Pi** (`admin@raspi-nas`) óránként futtatja a scrapert systemd timer-rel
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

## Raspi elérés

```bash
ssh admin@raspi-nas
```

A repo a Raspi-n: `/opt/odds-auto`

Systemd fájlok: `~/.config/systemd/user/odds-scraper.{service,timer}`

## Hasznos parancsok (Raspi-n futtatva)

```bash
# Timer állapot
systemctl --user status odds-scraper.timer

# Kézi futtatás
systemctl --user start odds-scraper.service

# Logok
systemctl --user status odds-scraper.service

# Timer leállítás (pl. ha online szolgáltatásra váltasz)
systemctl --user disable --now odds-scraper.timer

# Timer újraindítás
systemctl --user enable --now odds-scraper.timer
```

## Ismert limitáció

A BetLabel blokkolja a datacenter IP-ket (GitHub Actions, Cloudflare Workers stb.), ezért a scraper csak "normál" IP-ről fut — jelenleg a Raspi-ról. Ha a Raspi nem elérhető, nem frissül az odds.json, de a landing page ilyenkor is a legutóbbi adatot mutatja.

---

## Későbbi fejlesztés: online szolgáltatásra váltás

Ha a Raspi-t ki akarod váltani, két útvonal van:

### A) Cloudflare Worker proxy + GitHub Actions

A Worker proxy-ként lekéri a BetLabel HTML-t edge IP-ről (amit nem blokkol a BetLabel), a GitHub Actions scraper pedig a Worker URL-t hívja.

**1. Worker létrehozás (`worker/index.js`):**
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

**2. Worker deploy:**
```bash
# worker/wrangler.toml kell hozzá (name = "betlabel-proxy")
npx wrangler deploy
```
Követelmény: Cloudflare account verified email-lel.

**3. Scraper átállítás:**
A `betlabel.mjs`-ben a `PAGE_URL`-t cseréld:
```js
const PAGE_URL = 'https://betlabel-proxy.ACCOUNTNEV.workers.dev/?key=TITKOS_KULCS';
```

**4. GitHub Actions workflow visszarakása:**
Hozz létre `.github/workflows/update-odds.yml`-t:
```yaml
name: Update Odds
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm run scrape
      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git diff --quiet odds.json 2>/dev/null && exit 0
          git add odds.json
          git commit -m "Update odds $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push
```

**5. Raspi timer kikapcsolása:**
```bash
ssh admin@raspi-nas
systemctl --user disable --now odds-scraper.timer
```

### B) Másik VPS

1. Klónold a repót a szerverre
2. Állítsd be a git auth-ot (`gh auth login` vagy `git config credential.helper store` + PAT token)
3. Másold a systemd fájlokat a Raspi-ról:
   - `~/.config/systemd/user/odds-scraper.service`
   - `~/.config/systemd/user/odds-scraper.timer`
4. `systemctl --user enable --now odds-scraper.timer`
5. Raspi timer kikapcsolása: `systemctl --user disable --now odds-scraper.timer`
