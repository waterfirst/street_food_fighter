import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', chunk => process.stdout.write(chunk));
server.stderr.on('data', chunk => process.stderr.write(chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('테스트 서버가 시작되지 않았습니다.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  await waitForServer();
  const htmlResponse = await fetch(BASE_URL);
  const html = await htmlResponse.text();
  assert(htmlResponse.ok && html.includes('실시간 혼잡 레이더'), '메인 HTML을 정상 제공해야 합니다.');

  const apiResponse = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ truckId: 'fire-taco', items: [{ menuId: 'taco-signature', quantity: 2 }] })
  });
  const apiOrder = await apiResponse.json();
  assert(apiResponse.status === 201, '주문 API가 201을 반환해야 합니다.');
  assert(apiOrder.amount === 23800, '서버가 주문 금액을 메뉴 가격으로 재계산해야 합니다.');

  const tempDir = resolve('artifacts/tmp');
  await mkdir(tempDir, { recursive: true });
  process.env.TMPDIR = process.env.CI ? '/tmp' : tempDir;
  const browserPath = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/opt/pw-browsers/chromium', chromium.executablePath()].find(path => path && existsSync(path));
  if (!browserPath) {
    console.log('✓ 정적 제공, 주문 API, 서버 금액 재계산 테스트 통과');
    console.log('ℹ Chromium이 없어 브라우저 UI 테스트는 건너뜁니다. CI에서는 전체 테스트를 실행합니다.');
    return;
  }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.request().url().startsWith(BASE_URL) ? route.continue() : route.abort());
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    assert((await page.title()).includes('Street Food Fighter'), '페이지 제목이 올바르지 않습니다.');
    assert(await page.locator('.truck-card').count() === 4, '푸드트럭 4개가 표시되어야 합니다.');
    assert(await page.locator('.rank-row').count() === 4, '혼잡도 순위 4개가 표시되어야 합니다.');

    await page.locator('.truck-card').first().click();
    await page.locator('#menuDialog[open]').waitFor();
    await page.locator('[data-delta="1"]').first().click();
    await page.locator('#cartDock:not([hidden])').waitFor();
    await page.locator('#cartDock').click();
    await page.locator('#checkoutDialog[open]').waitFor();
    await page.locator('input[value="NAVERPAY"]').check();
    await page.locator('#termsCheck').check();
    await page.locator('#paymentButton').click();
    await page.locator('#ordersView.active').waitFor();
    assert(await page.locator('.order-card').count() === 1, '결제 후 주문 카드가 생성되어야 합니다.');
    assert((await page.locator('.pickup-code strong').textContent()).trim().length === 4, '픽업 번호는 4자리여야 합니다.');
    await page.screenshot({ path: 'artifacts/ui-desktop.png', fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await mobile.route('**/*', route => route.request().url().startsWith(BASE_URL) ? route.continue() : route.abort());
    await mobile.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    assert(await mobile.locator('.mobile-nav').isVisible(), '모바일 하단 내비게이션이 보여야 합니다.');
    await mobile.screenshot({ path: 'artifacts/ui-mobile.png', fullPage: true });
    console.log('✓ UI, 주문 흐름, 혼잡도 레이더, 서버 금액 검증 테스트 통과');
  } finally {
    await browser.close();
  }
}

run()
  .catch(error => {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => server.kill('SIGTERM'));
