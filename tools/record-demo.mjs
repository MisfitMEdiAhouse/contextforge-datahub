import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE_URL = 'https://contextforge-datahub-app.vercel.app/';
const RAW_DIR = 'artifacts/raw-video';
const OUT_DIR = 'artifacts';

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: {
    dir: RAW_DIR,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();
const video = page.video();

await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('#guideStartBottom', { state: 'attached' });
await page.waitForTimeout(1600);

// Establish the whole-product scope first, matching the final submission strategy.
const maxY = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
const increments = Math.max(12, Math.ceil(maxY / 460));
for (let i = 0; i <= increments; i++) {
  const y = Math.round((maxY * i) / increments);
  await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'smooth' }), y);
  await page.waitForTimeout(520);
}

await page.locator('#judgeTakeaway').scrollIntoViewIfNeeded();
await page.waitForTimeout(1800);

// Launch Judge Mode through the bottom CTA. It intentionally delegates to the same
// top Start button path used elsewhere in the app.
await page.locator('#guideStartBottom').click();
await page.waitForSelector('body.guide-active');
await page.waitForTimeout(1200);

for (let step = 1; step <= 14; step++) {
  await page.waitForFunction(
    (n) => document.getElementById('guideStepLabel')?.textContent?.includes(`Step ${n} of 14`),
    step,
    { timeout: 10_000 },
  );

  const narration = (await page.locator('#guideText').innerText()).trim();
  const wordCount = narration.split(/\s+/).filter(Boolean).length;
  // Approximate the live browser narration cadence while keeping the full video well below 3 minutes.
  const holdMs = Math.min(11_000, Math.max(3800, Math.round(wordCount * 330)));
  await page.waitForTimeout(holdMs);

  if (step < 14) {
    await page.locator('#guideNext').click();
    await page.waitForTimeout(420);
  }
}

await page.waitForTimeout(3600);
await page.close();
await context.close();
await browser.close();

if (!video) throw new Error('Playwright did not create a recording.');
await video.saveAs(`${OUT_DIR}/contextforge-demo.webm`);
console.log('Saved artifacts/contextforge-demo.webm');
