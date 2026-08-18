const CONFIG = { apiBaseUrl: '', ...window.SFF_CONFIG };
const ORDERS_KEY = 'sff_orders_v2';
const PENDING_KEY = 'sff_pending_order_v2';
const $ = id => document.getElementById(id);

function finish(type, title, message, order) {
  $('resultMark').className = `result-mark ${type}`;
  $('resultMark').textContent = type === 'success' ? '✓' : '!';
  $('resultTitle').textContent = title;
  $('resultMessage').textContent = message;
  if (order) {
    $('resultDetails').hidden = false;
    $('resultDetails').innerHTML = `<div><span>픽업 번호</span><strong>${order.pickupCode}</strong></div><div><span>예상 픽업</span><strong>${new Date(order.readyAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</strong></div>`;
  }
  $('resultButton').hidden = false;
}

async function confirm() {
  const params = new URLSearchParams(location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount'));
  let pending;
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch { pending = null; }
  if (!paymentKey || !orderId || !amount || !pending || pending.orderId !== orderId || Number(pending.amount) !== amount) {
    return finish('error', '결제 정보를 확인할 수 없습니다', '주문 정보가 없거나 결제 금액이 일치하지 않습니다.');
  }
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.message || '결제 승인에 실패했습니다.');
    let orders = [];
    try { orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch { orders = []; }
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...orders.filter(item => item.orderId !== order.orderId)].slice(0,20)));
    localStorage.removeItem(PENDING_KEY);
    finish('success', '주문이 접수되었습니다', `${order.truckName}에서 맛있게 준비하고 있습니다.`, order);
  } catch (error) {
    finish('error', '결제 승인에 실패했습니다', error.message || '잠시 후 다시 시도해주세요.');
  }
}

confirm();
