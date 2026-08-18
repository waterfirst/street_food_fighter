# 혼잡도·픽업 ETA 운영 설계

## 현재 구현

고객은 네 개 신호를 한 화면에서 비교합니다.

| 신호 | 의미 | 고객 화면 |
| --- | --- | --- |
| 현재 대기 주문 | 결제됐지만 완료되지 않은 주문 | 현재 대기 팀 수 |
| 최근 15분 주문 | 짧은 시간에 유입되는 수요 | 혼잡도 지수 |
| 5분 처리량 | 트럭이 실제로 완료할 수 있는 주문 수 | 예상 준비시간 |
| 현장·앱 관심 고객 | 아직 주문하지 않은 잠재 대기 | 레이더 밀도 |

혼잡도는 처리량이 큰 트럭이 주문 수가 많다는 이유만으로 불리해지지 않도록 모든 주문 수를 처리량으로 정규화합니다. 현재 UI는 `data.js`의 샘플 신호를 10초마다 소폭 갱신합니다.

## 운영 데이터 구조

실서비스에서는 아래 이벤트를 서버 시간 기준으로 저장해야 합니다.

### `orders`

- `order_id`, `truck_id`, `customer_id`
- `ordered_at`, `paid_at`, `accepted_at`, `started_at`, `ready_at`, `picked_up_at`
- `estimated_ready_at`, `amount`, `payment_status`, `order_status`

### `order_items`

- `order_id`, `menu_id`, `quantity`, `unit_price`
- `prep_weight`, `station_type`

### `truck_capacity_snapshots`

- `truck_id`, `captured_at`
- `active_stations`, `orders_completed_5m`, `queue_orders`
- `manual_delay_minutes`, `sold_out_menu_ids`

### `demand_events`

- `truck_id`, `session_id`, `event_type`, `captured_at`
- `distance_bucket`, `coarse_location_cell`

정밀 GPS는 장기 보관하지 않고 거리 구간 또는 격자 셀로 축소해 개인정보 위험을 줄입니다.

## ETA 고도화 단계

1. **규칙 기반**: 대기 주문 ÷ 최근 처리량 + 메뉴 조리 가중치. 현재 구현입니다.
2. **분위수 회귀**: 시간대, 날씨, 주문 구성, 조리 인원으로 P50/P90 준비시간 예측.
3. **온라인 보정**: 최근 10건의 예측 오차로 트럭별 편향을 실시간 보정.
4. **신뢰구간 표시**: 데이터가 부족하면 단일 숫자 대신 `12~18분`처럼 범위를 넓힘.

운영 KPI는 ETA MAE뿐 아니라 `예정보다 5분 이상 늦은 주문 비율`, `완성 후 10분 이상 미수령 비율`, `결제 이탈률`을 함께 봐야 합니다.

## 사업화에 필요한 다음 계층

- PostgreSQL/Supabase: 주문·메뉴·센싱 이벤트 영속화
- 운영자 화면: 주문 수락, 조리 시작, 준비 완료, 품절, 수동 지연
- 웹훅: 결제 승인·취소를 멱등하게 반영
- 정산: 트럭별 매출, 수수료, 환불, 지급대행
- 알림: 준비 5분 전·완료 시 웹 푸시 또는 문자
- 관리자 분석: 장소·시간대별 수요, 재방문, 트럭별 처리량과 ETA 정확도
