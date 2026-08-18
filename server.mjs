import { createServer } from 'node:http';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { TRUCKS, calculateTruckMetrics, findMenuItem } from './data.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY || '';
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const orders = new Map();
const RUNTIME_DIR = process.env.SFF_DATA_DIR || join(ROOT, '.runtime');
const ORDERS_FILE = join(RUNTIME_DIR, 'orders.json');
let persistQueue = Promise.resolve();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

async function loadOrders() {
  await mkdir(RUNTIME_DIR, { recursive: true });
  try {
    const stored = JSON.parse(await readFile(ORDERS_FILE, 'utf8'));
    if (Array.isArray(stored)) stored.forEach(order => orders.set(order.orderId, order));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Order store could not be loaded: ${error.message}`);
  }
}

function persistOrders() {
  persistQueue = persistQueue.then(async () => {
    const tempFile = `${ORDERS_FILE}.tmp`;
    await writeFile(tempFile, JSON.stringify([...orders.values()], null, 2), 'utf8');
    await rename(tempFile, ORDERS_FILE);
  });
  return persistQueue;
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': contentType.includes('text/html') ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)'
  });
  response.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) throw new Error('요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function createOrderId() {
  return `SFF${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;
}

function calculateOrder(truckId, requestedItems) {
  const truck = TRUCKS.find(item => item.id === truckId);
  if (!truck) throw new Error('푸드트럭을 찾을 수 없습니다.');
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) throw new Error('주문 메뉴가 없습니다.');
  const items = requestedItems.map(requested => {
    const menu = findMenuItem(truckId, requested.menuId);
    const quantity = Number(requested.quantity);
    if (!menu || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('주문 메뉴 또는 수량이 올바르지 않습니다.');
    return { id: menu.id, name: menu.name, price: menu.price, prepWeight: menu.prepWeight, quantity };
  });
  const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const baseEta = calculateTruckMetrics(truck).eta;
  const extraLoad = Math.max(0, items.reduce((sum, item) => sum + item.prepWeight * item.quantity, 0) - 1);
  const eta = baseEta + Math.ceil(extraLoad * 1.5);
  return { truck, items, amount, eta };
}

async function createOrder(request, response) {
  try {
    const body = await readJson(request);
    const calculated = calculateOrder(body.truckId, body.items);
    const createdAt = Date.now();
    const order = {
      orderId: createOrderId(),
      pickupCode: String(Math.floor(1000 + Math.random() * 9000)),
      truckId: calculated.truck.id,
      truckName: calculated.truck.name,
      items: calculated.items.map(({ prepWeight, ...item }) => item),
      amount: calculated.amount,
      paymentStatus: 'PENDING',
      createdAt,
      readyAt: createdAt + calculated.eta * 60_000
    };
    orders.set(order.orderId, order);
    await persistOrders();
    send(response, 201, order);
  } catch (error) {
    send(response, 400, { code: 'INVALID_ORDER', message: error.message });
  }
}

async function confirmPayment(request, response) {
  try {
    if (!TOSS_SECRET_KEY) return send(response, 503, { code: 'PAYMENT_NOT_CONFIGURED', message: '결제 시크릿 키가 설정되지 않았습니다.' });
    const { paymentKey, orderId, amount } = await readJson(request);
    const order = orders.get(orderId);
    if (!order) return send(response, 404, { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' });
    if (order.paymentStatus === 'PAID') return send(response, 200, order);
    if (!paymentKey || Number(amount) !== order.amount) return send(response, 400, { code: 'AMOUNT_MISMATCH', message: '결제 금액 또는 결제 키가 올바르지 않습니다.' });

    const authorization = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount })
    });
    const payment = await tossResponse.json();
    if (!tossResponse.ok) return send(response, tossResponse.status, { code: payment.code || 'PAYMENT_FAILED', message: payment.message || '결제 승인에 실패했습니다.' });

    Object.assign(order, {
      paymentStatus: 'PAID',
      paymentKey,
      paymentMethod: payment.easyPay?.provider || payment.method,
      approvedAt: payment.approvedAt
    });
    orders.set(order.orderId, order);
    await persistOrders();
    send(response, 200, order);
  } catch (error) {
    send(response, 500, { code: 'CONFIRM_ERROR', message: error.message || '결제 승인 중 오류가 발생했습니다.' });
  }
}

async function serveStatic(pathname, response) {
  if (pathname === '/config.js') {
    const config = `window.SFF_CONFIG=${JSON.stringify({ paymentMode: TOSS_CLIENT_KEY && TOSS_SECRET_KEY ? 'live' : 'demo', tossClientKey: TOSS_CLIENT_KEY, apiBaseUrl: '' })};`;
    return send(response, 200, config, 'text/javascript; charset=utf-8');
  }
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    send(response, 200, body, mimeTypes[extname(filePath)] || 'application/octet-stream');
  } catch {
    send(response, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'POST' && url.pathname === '/api/orders') return createOrder(request, response);
  if (request.method === 'POST' && url.pathname === '/api/payments/confirm') return confirmPayment(request, response);
  if (request.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
    const order = orders.get(decodeURIComponent(url.pathname.slice('/api/orders/'.length)));
    return order ? send(response, 200, order) : send(response, 404, { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' });
  return serveStatic(url.pathname, response);
});

await loadOrders();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Street Food Fighter running at http://localhost:${PORT}`);
  console.log(`Payment mode: ${TOSS_CLIENT_KEY && TOSS_SECRET_KEY ? 'live' : 'demo'}`);
});
