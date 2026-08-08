import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE_URL = 'https://contextforge-datahub-app.vercel.app/';
const RAW_DIR = 'artifacts/raw-video-audio';
const OUT_DIR = 'artifacts';
const audioMeta = JSON.parse(fs.readFileSync('artifacts/audio-meta.json', 'utf8'));

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
if (!video) throw new Error('Playwright did not create a recording.');

// The final MP4 receives the same exact live Judge Mode narration as a neural
// voice track in post. Suppress OS speech here so the visual run remains deterministic.
await page.addInitScript(() => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.speak = () => {};
    window.speechSynthesis.cancel = () => {};
  }
});

const t0 = Date.now();
const timeline = [];

await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('#guideStart', { state: 'visible' });

// Open on the real current hero, then launch the product's own Judge Mode from the top.
await page.locator('#guideStart').scrollIntoViewIfNeeded();
await page.waitForTimeout(2200);
await page.locator('#guideStart').click();
await page.waitForSelector('body.guide-active');

for (let step = 1; step <= 14; step++) {
  await page.waitForFunction(
    (n) => document.getElementById('guideStepLabel')?.textContent?.includes(`Step ${n} of 14`),
    step,
    { timeout: 10_000 },
  );

  // Let the app's own scroll/spotlight settle, just as a human viewer would.
  await page.waitForTimeout(320);

  const liveText = (await page.locator('#guideText').innerText()).trim();
  const meta = audioMeta.find((x) => x.step === step);
  if (!meta) throw new Error(`Missing audio metadata for step ${step}`);
  if (meta.text !== liveText) {
    throw new Error(`Live narration changed at step ${step}; refusing to record stale audio.`);
  }

  timeline.push({
    step,
    start_ms: Date.now() - t0,
    duration_s: meta.duration_s,
    file: meta.file,
    text: liveText,
  });

  // Hold the actual live step for the full spoken narration, then give judges
  // a short beat before the next product action.
  await page.waitForTimeout(Math.ceil(meta.duration_s * 1000) + 520);

  if (step < 14) {
    await page.locator('#guideNext').click();
  }
}

await page.waitForTimeout(1400);
fs.writeFileSync(`${OUT_DIR}/timeline.json`, JSON.stringify(timeline, null, 2));

const savePromise = video.saveAs(`${OUT_DIR}/contextforge-demo-audio.webm`);
await page.close();
await savePromise;
await context.close();
await browser.close();

console.log('Saved artifacts/contextforge-demo-audio.webm and timeline.json');
