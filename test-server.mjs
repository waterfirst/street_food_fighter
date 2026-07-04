import { chromium } from 'playwright';

async function testUbuntuServer() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage();

  try {
    console.log('Navigating to http://221.153.204.191/...');
    const response = await page.goto('http://221.153.204.191/', {
      waitUntil: 'networkidle'
    });

    console.log(`✓ Response status: ${response.status()}`);
    console.log(`✓ URL: ${page.url()}`);

    const title = await page.title();
    console.log(`✓ Page title: ${title}`);

    const content = await page.content();
    console.log(`✓ Page loaded successfully (content length: ${content.length} bytes)`);

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

testUbuntuServer();
