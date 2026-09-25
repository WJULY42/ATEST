import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 });
// 点击新游戏
await page.click('#btn-new');
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: '/tmp/shot-space.png' });
// 飞行一段
await page.keyboard.down('KeyW');
await new Promise(r => setTimeout(r, 3000));
await page.keyboard.up('KeyW');
// 打开星图
await page.keyboard.press('KeyM');
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: '/tmp/shot-starmap.png' });
await page.keyboard.press('KeyM');
console.log('HUD visible:', await page.$eval('#hud', el => !el.classList.contains('hidden')));
console.log('errors:', errors.length ? errors : 'NONE');
await browser.close();
