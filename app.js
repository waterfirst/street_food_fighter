import { TRUCKS, calculateTruckMetrics, findMenuItem } from './data.js';

const CONFIG = {
  paymentMode: 'demo',
  tossClientKey: '',
  apiBaseUrl: '',
  ...window.SFF_CONFIG
};

const STORAGE = {
  orders: 'sff_orders_v2',
  customerKey: 'sff_customer_key_v2',
  pendingOrder: 'sff_pending_order_v2'
};

const state = {
  category: 'all',
  query: '',
  sort: 'recommended',
  currentTruckId: null,
  cart: { truckId: null, items: {} },
  toastTimer: null
};

const $ = id => document.getElementById(id);
const won = value => `${Number(value).toLocaleString('ko-KR')}원`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function getTruck(id) {
  return TRUCKS.find(truck => truck.id === id);
}

function getPointColor(metrics) {
  return metrics.crowd === 'hot' ? '#ff6845' : metrics.crowd === 'busy' ? '#ffe249' : '#d8ff45';
}

function categories() {
  return [
    { key: 'all', label: '전체' },
    { key: 'taco', label: '🌮 타코' },
    { key: 'burger', label: '🍔 버거' },
    { key: 'korean', label: '🍢 한식' },
    { key: 'dessert', label: '☕ 디저트' }
  ];
}

function renderCategories() {
  $('categoryList').innerHTML = categories().map(category => `
    <button class="category-chip ${state.category === category.key ? 'active' : ''}" type="button" data-category="${category.key}">
      ${category.label}
    </button>`).join('');
}

function filteredTrucks() {
  const query = state.query.trim().toLowerCase();
  const trucks = TRUCKS.filter(truck => {
    const categoryMatches = state.category === 'all' || truck.categoryKey === state.category;
    const searchable = [truck.name, truck.category, ...truck.tags, ...truck.menu.flatMap(item => [item.name, item.description])].join(' ').toLowerCase();
    return categoryMatches && (!query || searchable.includes(query));
  });
  const sorters = {
    eta: (a, b) => calculateTruckMetrics(a).eta - calculateTruckMetrics(b).eta,
    crowd: (a, b) => calculateTruckMetrics(b).crowdIndex - calculateTruckMetrics(a).crowdIndex,
    distance: (a, b) => a.distance - b.distance,
    recommended: (a, b) => (b.rating * 20 - calculateTruckMetrics(b).eta) - (a.rating * 20 - calculateTruckMetrics(a).eta)
  };
  return trucks.sort(sorters[state.sort]);
}

function truckCard(truck) {
  const metrics = calculateTruckMetrics(truck);
  return `
    <article class="truck-card" tabindex="0" role="button" data-truck-id="${truck.id}" aria-label="${escapeHtml(truck.name)} 메뉴 보기">
      <div class="truck-art" style="--art-bg:${truck.artBg};--truck-color:${truck.truckColor}">
        <span class="food-stamp" aria-hidden="true">${truck.emoji}</span>
        <span class="wheel one"></span><span class="wheel two"></span>
        <span class="crowd-pill ${metrics.crowd}"><i></i>${metrics.crowdLabel} · ${metrics.crowdIndex}</span>
      </div>
      <div class="truck-info">
        <div>
          <h3>${escapeHtml(truck.name)}</h3>
          <p class="truck-meta">★ ${truck.rating} (${truck.reviews}) · ${truck.distance.toFixed(1)}km</p>
          <div class="truck-tags">${truck.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        </div>
        <div class="eta-box"><small>예상 준비</small><strong>${metrics.eta}분</strong><span>${truck.trend >= 0 ? '↗' : '↘'} ${Math.abs(truck.trend)}%</span></div>
      </div>
    </article>`;
}

function renderTruckList() {
  const trucks = filteredTrucks();
  $('truckList').innerHTML = trucks.map(truckCard).join('');
  $('resultCount').textContent = trucks.length;
  $('truckList').hidden = trucks.length === 0;
  $('emptyState').hidden = trucks.length > 0;

  const metrics = TRUCKS.map(calculateTruckMetrics);
  $('openTruckCount').textContent = TRUCKS.length;
  $('averageEta').textContent = Math.round(metrics.reduce((sum, item) => sum + item.eta, 0) / metrics.length);
  $('liveOrderCount').textContent = TRUCKS.reduce((sum, truck) => sum + truck.queueOrders, 0);
}

function renderRadar() {
  $('radarMap').innerHTML = `
    <span class="map-street" style="left:13%;top:48%">RIVERSIDE WALK</span>
    <span class="map-street" style="right:7%;top:53%;transform:rotate(31deg)">PARK AVENUE</span>
    ${TRUCKS.map(truck => {
      const metrics = calculateTruckMetrics(truck);
      return `<button class="radar-point" type="button" data-truck-id="${truck.id}" aria-label="${escapeHtml(truck.name)}, 혼잡도 ${metrics.crowdIndex}" style="left:${truck.point.x}%;top:${truck.point.y}%;--crowd:${metrics.crowdIndex};--point-color:${getPointColor(metrics)}"><span>${truck.emoji}</span></button>`;
    }).join('')}`;

  const ranked = [...TRUCKS].sort((a, b) => calculateTruckMetrics(b).crowdIndex - calculateTruckMetrics(a).crowdIndex);
  $('crowdRanking').innerHTML = ranked.map((truck, index) => {
    const metrics = calculateTruckMetrics(truck);
    const color = getPointColor(metrics);
    return `<div class="rank-row"><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(truck.name)}</span><span class="rank-bar"><i style="width:${metrics.crowdIndex}%;--bar-color:${color}"></i></span><b style="--bar-color:${color}">${metrics.crowdIndex}</b></div>`;
  }).join('');
}

function renderAll() {
  renderCategories();
  renderTruckList();
  renderRadar();
}

function openTruckMenu(truckId) {
  const truck = getTruck(truckId);
  if (!truck) return;
  state.currentTruckId = truckId;
  const metrics = calculateTruckMetrics(truck);
  $('menuVisual').style.setProperty('--art-bg', truck.artBg);
  $('menuVisual').style.setProperty('--truck-color', truck.truckColor);
  $('menuTags').innerHTML = truck.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
  $('menuTruckName').textContent = truck.name;
  $('menuTruckMeta').textContent = `★ ${truck.rating} (${truck.reviews}) · ${truck.category} · ${truck.distance.toFixed(1)}km`;
  $('menuEta').textContent = metrics.eta;
  $('queueSummary').innerHTML = `
    <div><span>현재 대기</span><strong>${truck.queueOrders}팀</strong></div>
    <div><span>혼잡도</span><strong>${metrics.crowdIndex} · ${metrics.crowdLabel}</strong></div>
    <div><span>15분 주문</span><strong>${truck.recentOrders}건</strong></div>`;
  renderMenuItems(truck);
  $('menuDialog').showModal();
  document.body.classList.add('dialog-open');
}

function itemQuantity(menuId) {
  return state.cart.truckId === state.currentTruckId ? Number(state.cart.items[menuId] || 0) : 0;
}

function renderMenuItems(truck) {
  $('menuList').innerHTML = `<h3>MENU</h3>${truck.menu.map(item => `
    <div class="menu-item">
      <div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.description)}</p><strong>${won(item.price)}</strong></div>
      <div class="quantity-control" aria-label="${escapeHtml(item.name)} 수량">
        <button type="button" data-menu-id="${item.id}" data-delta="-1" aria-label="수량 줄이기">−</button>
        <span>${itemQuantity(item.id)}</span>
        <button type="button" data-menu-id="${item.id}" data-delta="1" aria-label="수량 늘리기">+</button>
      </div>
    </div>`).join('')}`;
}

function updateCart(menuId, delta) {
  const truck = getTruck(state.currentTruckId);
  if (!truck || !findMenuItem(truck.id, menuId)) return;
  const hasOtherTruck = state.cart.truckId && state.cart.truckId !== truck.id && cartCount() > 0;
  if (hasOtherTruck && !window.confirm('다른 푸드트럭의 장바구니를 비우고 새로 담을까요?')) return;
  if (hasOtherTruck) state.cart = { truckId: truck.id, items: {} };
  if (!state.cart.truckId) state.cart.truckId = truck.id;
  const next = clamp(Number(state.cart.items[menuId] || 0) + delta, 0, 20);
  if (next === 0) delete state.cart.items[menuId]; else state.cart.items[menuId] = next;
  if (cartCount() === 0) state.cart = { truckId: null, items: {} };
  renderMenuItems(truck);
  renderCartDock();
}

function cartCount() {
  return Object.values(state.cart.items).reduce((sum, quantity) => sum + Number(quantity), 0);
}

function cartDetails() {
  const truck = getTruck(state.cart.truckId);
  if (!truck) return { truck: null, items: [], total: 0 };
  const items = Object.entries(state.cart.items).map(([menuId, quantity]) => ({
    ...findMenuItem(truck.id, menuId), quantity: Number(quantity)
  })).filter(item => item.id && item.quantity > 0);
  return { truck, items, total: items.reduce((sum, item) => sum + item.price * item.quantity, 0) };
}

function renderCartDock() {
  const count = cartCount();
  const { truck, total } = cartDetails();
  $('cartDock').hidden = count === 0;
  $('menuCartButton').hidden = count === 0 || state.currentTruckId !== state.cart.truckId;
  if (!truck) return;
  $('cartCount').textContent = count;
  $('cartTruckName').textContent = truck.name;
  $('cartTotal').textContent = won(total);
  $('menuCartCount').textContent = count;
  $('menuCartTotal').textContent = won(total);
}

function orderEta(details) {
  const metrics = calculateTruckMetrics(details.truck);
  const extraLoad = Math.max(0, details.items.reduce((sum, item) => sum + item.prepWeight * item.quantity, 0) - 1);
  return metrics.eta + Math.ceil(extraLoad * 1.5);
}

function openCheckout() {
  const details = cartDetails();
  if (!details.truck || details.items.length === 0) return;
  if ($('menuDialog').open) $('menuDialog').close();
  const eta = orderEta(details);
  const pickupAt = new Date(Date.now() + eta * 60_000);
  $('checkoutItems').innerHTML = details.items.map(item => `<div class="checkout-item"><span>${escapeHtml(item.name)} <b>× ${item.quantity}</b></span><strong>${won(item.price * item.quantity)}</strong></div>`).join('');
  $('checkoutPickupTime').textContent = pickupAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  $('checkoutEtaBadge').textContent = `${eta}분 후`;
  $('checkoutTruckName').textContent = details.truck.name;
  $('checkoutSubtotal').textContent = won(details.total);
  $('checkoutTotal').textContent = won(details.total);
  $('paymentButtonAmount').textContent = won(details.total);
  $('termsCheck').checked = false;
  $('paymentButton').disabled = true;
  $('paymentButtonText').textContent = CONFIG.paymentMode === 'live' ? '결제하기' : '테스트 결제';
  $('checkoutDialog').showModal();
  document.body.classList.add('dialog-open');
}

function getOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE.orders) || '[]'); } catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE.orders, JSON.stringify(orders));
}

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function createDemoOrder(paymentMethod) {
  const details = cartDetails();
  const eta = orderEta(details);
  const now = Date.now();
  const order = {
    orderId: `SFF-${now.toString(36).toUpperCase()}`,
    pickupCode: randomCode(),
    truckId: details.truck.id,
    truckName: details.truck.name,
    items: details.items.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
    amount: details.total,
    paymentMethod,
    paymentStatus: 'PAID_DEMO',
    createdAt: now,
    readyAt: now + eta * 60_000
  };
  saveOrders([order, ...getOrders()].slice(0, 20));
  details.truck.queueOrders += 1;
  return order;
}

async function createServerOrder(details) {
  const response = await fetch(`${CONFIG.apiBaseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truckId: details.truck.id,
      items: details.items.map(item => ({ menuId: item.id, quantity: item.quantity }))
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || '주문을 생성하지 못했습니다.');
  return payload;
}

function getCustomerKey() {
  let key = localStorage.getItem(STORAGE.customerKey);
  if (!key) {
    key = crypto.randomUUID ? crypto.randomUUID() : `customer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE.customerKey, key);
  }
  return key;
}

async function requestLivePayment(paymentMethod) {
  if (!CONFIG.tossClientKey || !CONFIG.apiBaseUrl || typeof window.TossPayments !== 'function') {
    throw new Error('운영 결제 설정이 완료되지 않았습니다. config.js와 서버 환경변수를 확인하세요.');
  }
  const details = cartDetails();
  const serverOrder = await createServerOrder(details);
  localStorage.setItem(STORAGE.pendingOrder, JSON.stringify({
    ...serverOrder,
    truckName: details.truck.name,
    items: details.items,
    paymentMethod
  }));

  const tossPayments = window.TossPayments(CONFIG.tossClientKey);
  const payment = tossPayments.payment({ customerKey: getCustomerKey() });
  const params = {
    method: 'CARD',
    amount: { currency: 'KRW', value: serverOrder.amount },
    orderId: serverOrder.orderId,
    orderName: details.items.length > 1 ? `${details.items[0].name} 외 ${details.items.length - 1}건` : details.items[0].name,
    successUrl: new URL('./payment-success.html', window.location.href).href,
    failUrl: new URL('./payment-fail.html', window.location.href).href,
    customerName: 'Street Food Fighter 고객'
  };
  if (paymentMethod !== 'CARD') params.card = { flowMode: 'DIRECT', easyPay: paymentMethod };
  await payment.requestPayment(params);
}

async function handlePayment() {
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'CARD';
  const button = $('paymentButton');
  button.disabled = true;
  $('paymentButtonText').textContent = '결제 준비 중…';
  try {
    if (CONFIG.paymentMode === 'live') {
      await requestLivePayment(paymentMethod);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
    const order = createDemoOrder(paymentMethod);
    state.cart = { truckId: null, items: {} };
    renderCartDock();
    $('checkoutDialog').close();
    document.body.classList.remove('dialog-open');
    renderAll();
    renderOrders();
    switchView('orders');
    showToast(`주문 완료 · 픽업 번호 ${order.pickupCode}`);
  } catch (error) {
    showToast(error.message || '결제 요청 중 오류가 발생했습니다.');
    button.disabled = false;
    $('paymentButtonText').textContent = CONFIG.paymentMode === 'live' ? '결제하기' : '테스트 결제';
  }
}

function orderStage(order) {
  const total = Math.max(1, order.readyAt - order.createdAt);
  const elapsed = Date.now() - order.createdAt;
  const ratio = clamp(elapsed / total, 0, 1);
  if (ratio < .2) return 0;
  if (ratio < .82) return 1;
  return 2;
}

function remainingText(order) {
  const remaining = Math.max(0, order.readyAt - Date.now());
  if (remaining === 0) return '픽업 가능';
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  return `${minutes}분 남음`;
}

function renderOrders() {
  const orders = getOrders().filter(order => Date.now() - order.createdAt < 86_400_000);
  $('noOrders').hidden = orders.length > 0;
  $('orderList').hidden = orders.length === 0;
  $('orderList').innerHTML = orders.map(order => {
    const stage = orderStage(order);
    const pickupTime = new Date(order.readyAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return `<article class="order-card">
      <div class="order-card-head"><div><h2>${escapeHtml(order.truckName)}</h2><p>${escapeHtml(order.orderId)} · ${won(order.amount)}</p></div><div class="pickup-code"><small>픽업 번호</small><strong>${escapeHtml(order.pickupCode)}</strong></div></div>
      <div class="order-progress">
        <div class="countdown"><div><span>예상 픽업 ${pickupTime}</span><strong>${remainingText(order)}</strong></div><small>${stage === 2 ? '곧 완성돼요' : '시간을 맞춰 조리 중'}</small></div>
        <div class="progress-track">
          ${['주문 접수','조리 중','픽업 준비'].map((label, index) => `<div class="progress-step ${index < stage ? 'done' : index === stage ? 'current' : ''}"><i></i><span>${label}</span></div>`).join('')}
        </div>
        <p class="order-items-summary">${order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(' · ')}</p>
      </div>
    </article>`;
  }).join('');
}

function switchView(view) {
  const discover = view === 'discover';
  $('discoverView').classList.toggle('active', discover);
  $('ordersView').classList.toggle('active', !discover);
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (!discover) renderOrders();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  state.toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
  if (!$('menuDialog').open && !$('checkoutDialog').open) document.body.classList.remove('dialog-open');
}

function bindEvents() {
  $('categoryList').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderCategories();
    renderTruckList();
  });
  $('searchInput').addEventListener('input', event => { state.query = event.target.value; renderTruckList(); });
  $('sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderTruckList(); });
  $('truckList').addEventListener('click', event => {
    const card = event.target.closest('[data-truck-id]');
    if (card) openTruckMenu(card.dataset.truckId);
  });
  $('truckList').addEventListener('keydown', event => {
    const card = event.target.closest('[data-truck-id]');
    if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openTruckMenu(card.dataset.truckId); }
  });
  $('radarMap').addEventListener('click', event => {
    const point = event.target.closest('[data-truck-id]');
    if (point) openTruckMenu(point.dataset.truckId);
  });
  $('menuList').addEventListener('click', event => {
    const button = event.target.closest('[data-menu-id]');
    if (button) updateCart(button.dataset.menuId, Number(button.dataset.delta));
  });
  $('cartDock').addEventListener('click', openCheckout);
  $('menuCartButton').addEventListener('click', openCheckout);
  $('termsCheck').addEventListener('change', event => { $('paymentButton').disabled = !event.target.checked; });
  $('paymentButton').addEventListener('click', handlePayment);
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  [$('menuDialog'), $('checkoutDialog')].forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', () => { if (!$('menuDialog').open && !$('checkoutDialog').open) document.body.classList.remove('dialog-open'); });
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  document.querySelector('[data-focus-search]').addEventListener('click', () => {
    switchView('discover');
    setTimeout(() => { $('searchInput').focus(); $('searchInput').scrollIntoView({ block: 'center' }); }, 100);
  });
  $('notificationButton').addEventListener('click', () => showToast('새 알림이 없습니다. 주문 상태는 여기서 알려드릴게요.'));
  $('locationButton').addEventListener('click', () => {
    if (!navigator.geolocation) return showToast('이 브라우저에서는 위치를 사용할 수 없습니다.');
    showToast('현재 위치를 확인하고 있습니다…');
    navigator.geolocation.getCurrentPosition(
      () => { $('locationLabel').textContent = '내 위치 기준'; showToast('가까운 트럭 순으로 업데이트했습니다.'); },
      () => showToast('위치 권한이 없어 여의도 기준으로 보여드립니다.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function updateLiveSignals() {
  TRUCKS.forEach((truck, index) => {
    const direction = ((Date.now() / 10_000 + index) % 3) < 1.5 ? 1 : -1;
    truck.activeVisitors = clamp(truck.activeVisitors + direction, 4, 49);
    if (index < 2 && Math.random() > .62) truck.recentOrders = clamp(truck.recentOrders + direction, 4, 24);
  });
  renderTruckList();
  renderRadar();
}

renderAll();
renderOrders();
renderCartDock();
bindEvents();
if (window.location.hash === '#orders') switchView('orders');
setInterval(updateLiveSignals, 10_000);
setInterval(() => { if ($('ordersView').classList.contains('active')) renderOrders(); }, 30_000);
