import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE_URL = 'https://contextforge-datahub-app.vercel.app/';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

// We only need the exact live on-screen narration text in this pass.
await page.addInitScript(() => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.speak = () => {};
    window.speechSynthesis.cancel = () => {};
  }
});

await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('#guideStart', { state: 'visible' });
await page.locator('#guideStart').click();
await page.waitForSelector('body.guide-active');

const steps = [];
for (let step = 1; step <= 14; step++) {
  await page.waitForFunction(
    (n) => document.getElementById('guideStepLabel')?.textContent?.includes(`Step ${n} of 14`),
    step,
    { timeout: 10_000 },
  );

  const label = (await page.locator('#guideStepLabel').innerText()).trim();
  const text = (await page.locator('#guideText').innerText()).trim();
  steps.push({ step, label, text });

  if (step < 14) {
    await page.locator('#guideNext').click();
    await page.waitForTimeout(180);
  }
}

fs.writeFileSync('artifacts/guide-text.json', JSON.stringify(steps, null, 2));
await context.close();
await browser.close();
console.log(`Captured ${steps.length} live Judge Mode narration steps.`);
