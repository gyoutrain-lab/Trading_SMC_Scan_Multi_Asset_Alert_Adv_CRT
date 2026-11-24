/* SMC watcher: opens the real index.html in headless Chrome on GitHub Actions and presses "Start alerts",
   so the early-entry alerts keep running (and push to your phone through ntfy) while your own browser is closed. */
const { chromium } = require('playwright');
const fs = require('fs');
const STATE = 'watcher/state.json', MIN = +process.env.RUN_MIN || 350, TOPIC = (process.env.NTFY_TOPIC || '').trim();
if (!TOPIC) { console.error('Missing secret NTFY_TOPIC'); process.exit(1); }
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: fs.existsSync(STATE) ? STATE : undefined });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
  await p.evaluate(({ k, t }) => {
    const set = (id, v) => { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    if (k) set('#key', k);
    set('#adNt', t);
    set('#adTs', '');                                   // blank = Auto symbols
    if (document.querySelector('#adOn').textContent.trim() === 'Start alerts') document.querySelector('#adOn').click();
  }, { k: (process.env.TD_KEY || '').trim(), t: TOPIC });
  console.log('Watcher started', new Date().toISOString());
  const end = Date.now() + MIN * 60000; let last = '', saved = 0;
  while (Date.now() < end) {
    await new Promise(r => setTimeout(r, 60000));
    const txt = await p.evaluate(() => (document.querySelector('#adTl') || {}).innerText || '').catch(() => '');
    if (txt && txt !== last) { last = txt; console.log(new Date().toISOString() + '\n' + txt.slice(0, 900)); }
    if (Date.now() - saved > 600000) { saved = Date.now(); await ctx.storageState({ path: STATE }).catch(() => {}); }
  }
  await ctx.storageState({ path: STATE }).catch(() => {});
  await b.close();
})();
