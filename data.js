export const TRUCKS = [
  {
    id: 'fire-taco',
    name: '불꽃 타코 클럽',
    category: '멕시칸',
    categoryKey: 'taco',
    emoji: '🌮',
    distance: 0.4,
    rating: 4.9,
    reviews: 284,
    tags: ['수제 살사', '비건 옵션'],
    queueOrders: 11,
    recentOrders: 20,
    throughputPer5: 4,
    activeVisitors: 45,
    basePrep: 6,
    trend: 24,
    artBg: 'linear-gradient(135deg,#ff754e 0%,#ffc447 100%)',
    truckColor: '#f6e2bf',
    point: { x: 67, y: 36 },
    menu: [
      { id: 'taco-signature', name: '불꽃 비리아 타코', description: '12시간 조리한 소고기, 콘소메, 치즈', price: 11900, prepWeight: 1.2 },
      { id: 'taco-shrimp', name: '칠리 라임 쉬림프 타코', description: '새우, 라임 크레마, 적양배추 피클', price: 10500, prepWeight: 1 },
      { id: 'taco-vegan', name: '그릴드 머쉬룸 타코', description: '표고·새송이, 아보카도 살사', price: 8900, prepWeight: .8 }
    ]
  },
  {
    id: 'seoul-smash',
    name: '서울 스매시 버거',
    category: '버거',
    categoryKey: 'burger',
    emoji: '🍔',
    distance: 0.7,
    rating: 4.8,
    reviews: 196,
    tags: ['한우 패티', '감자 번'],
    queueOrders: 8,
    recentOrders: 15,
    throughputPer5: 4,
    activeVisitors: 31,
    basePrep: 6,
    trend: 12,
    artBg: 'linear-gradient(135deg,#b6ddff 0%,#e3f4ff 100%)',
    truckColor: '#457aef',
    point: { x: 36, y: 63 },
    menu: [
      { id: 'smash-double', name: '더블 서울 스매시', description: '한우 패티 2장, 체더, 양파, 하우스 소스', price: 13900, prepWeight: 1.3 },
      { id: 'smash-single', name: '클래식 스매시', description: '한우 패티, 체더, 피클, 감자 번', price: 9900, prepWeight: 1 },
      { id: 'fries-garlic', name: '갈릭 파마산 프라이', description: '마늘 버터, 파마산, 파슬리', price: 5900, prepWeight: .6 }
    ]
  },
  {
    id: 'oden-lab',
    name: '오뎅 연구소',
    category: '한식',
    categoryKey: 'korean',
    emoji: '🍢',
    distance: 0.9,
    rating: 4.7,
    reviews: 158,
    tags: ['수제 어묵', '따뜻한 국물'],
    queueOrders: 3,
    recentOrders: 8,
    throughputPer5: 5,
    activeVisitors: 18,
    basePrep: 7,
    trend: -3,
    artBg: 'linear-gradient(135deg,#f5d7bb 0%,#fff1d8 100%)',
    truckColor: '#ef6c45',
    point: { x: 42, y: 29 },
    menu: [
      { id: 'oden-set', name: '연구소 모둠 어묵', description: '수제 어묵 5종과 무, 유부주머니', price: 9500, prepWeight: .7 },
      { id: 'tteokbokki', name: '가래떡 국물 떡볶이', description: '쌀떡, 대파, 비법 고추장 소스', price: 8500, prepWeight: 1 },
      { id: 'oden-cup', name: '부산 어묵 컵', description: '어묵 3종과 깊은 멸치 육수', price: 5500, prepWeight: .5 }
    ]
  },
  {
    id: 'sweet-cloud',
    name: '스위트 클라우드',
    category: '디저트',
    categoryKey: 'dessert',
    emoji: '☕',
    distance: 1.2,
    rating: 4.9,
    reviews: 321,
    tags: ['스페셜티', '수제 디저트'],
    queueOrders: 1,
    recentOrders: 6,
    throughputPer5: 8,
    activeVisitors: 12,
    basePrep: 5,
    trend: 6,
    artBg: 'linear-gradient(135deg,#d5c2ee 0%,#f3e8ff 100%)',
    truckColor: '#f4f0e8',
    point: { x: 73, y: 72 },
    menu: [
      { id: 'cloud-latte', name: '클라우드 크림 라테', description: '콜드브루, 바닐라 크림, 시나몬', price: 6500, prepWeight: .6 },
      { id: 'espresso-tonic', name: '자몽 에스프레소 토닉', description: '스페셜티 에스프레소, 자몽, 토닉', price: 7000, prepWeight: .7 },
      { id: 'cookie', name: '솔티 초콜릿 쿠키', description: '다크 초콜릿과 말돈 소금', price: 3900, prepWeight: .2 }
    ]
  }
];

export function calculateTruckMetrics(truck) {
  const queuePressure = Math.min(1.2, truck.queueOrders / Math.max(1, truck.throughputPer5 * 3));
  const inflowPressure = Math.min(1.2, truck.recentOrders / Math.max(1, truck.throughputPer5 * 3));
  const visitorPressure = Math.min(1, truck.activeVisitors / 50);
  const crowdIndex = Math.round(Math.min(99, queuePressure * 45 + inflowPressure * 35 + visitorPressure * 20));
  const eta = truck.basePrep + Math.ceil(truck.queueOrders / truck.throughputPer5) * 5;
  const crowd = crowdIndex >= 82 ? 'hot' : crowdIndex >= 55 ? 'busy' : 'calm';
  const crowdLabel = crowd === 'hot' ? '매우 혼잡' : crowd === 'busy' ? '붐빔' : '여유';
  return { crowdIndex, eta, crowd, crowdLabel };
}

export function findMenuItem(truckId, menuId) {
  return TRUCKS.find(truck => truck.id === truckId)?.menu.find(item => item.id === menuId);
}
