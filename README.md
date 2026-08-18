# Street Food Fighter

실시간 혼잡도, 예상 준비시간, 선결제를 하나의 흐름으로 연결한 푸드트럭 주문 웹앱입니다.

## 핵심 기능

- 카드·네이버페이·토스페이: 토스페이먼츠 SDK로 결제창을 열고 서버에서 금액을 재검증한 뒤 승인
- 혼잡도 레이더: 대기 주문, 최근 15분 주문, 현장 유입을 처리량 대비 지수로 변환
- 픽업 ETA: 현재 대기열과 트럭별 5분 처리량, 주문 메뉴 조리 가중치를 반영
- 주문 추적: 주문 접수 → 조리 중 → 픽업 준비 단계와 남은 시간, 4자리 픽업 번호 제공
- 반응형 UI: 데스크톱 대시보드와 모바일 바텀 내비게이션, 키보드·스크린리더 접근성 지원

데모: <https://waterfirst.github.io/street_food_fighter/>

> GitHub Pages는 서버 시크릿을 보관할 수 없으므로 안전한 테스트 결제로 동작합니다. 실제 결제는 아래 운영 서버 방식으로 실행해야 합니다.

## 실행

Node.js 18 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 <http://localhost:4173>을 엽니다. 결제 키가 없으면 데모 모드로 실행됩니다.

## 실제 결제 연결

1. 토스페이먼츠 개발자센터에서 API 개별 연동 클라이언트 키와 시크릿 키를 발급합니다.
2. `.env.example`을 참고해 실행 환경에 아래 값을 설정합니다.
3. Node 서버를 HTTPS 도메인에 배포합니다.

```bash
export TOSS_CLIENT_KEY=test_ck_your_client_key
export TOSS_SECRET_KEY=test_sk_your_secret_key
npm start
```

`TOSS_SECRET_KEY`는 브라우저 코드, `config.js`, GitHub 저장소에 절대 넣지 않습니다. 서버는 주문 메뉴 가격을 다시 계산하고, 결제 리다이렉트의 `orderId`와 `amount`가 저장된 주문과 일치할 때만 토스페이먼츠 승인 API를 호출합니다.

### 결제 흐름

1. `POST /api/orders`: 서버가 메뉴·수량·금액·ETA를 확정하고 `PENDING` 주문 생성
2. 브라우저: 카드 또는 간편결제 자체창으로 구매자 인증
3. `payment-success.html`: `paymentKey`, `orderId`, `amount`를 서버에 전달
4. `POST /api/payments/confirm`: 주문 금액 재검증 후 토스페이먼츠 승인
5. 승인 주문을 내 주문 화면에 저장하고 픽업 카운트다운 시작

운영 전에는 토스페이먼츠 가맹점 계약, 네이버페이·토스페이 이용 서비스 활성화, HTTPS, 취소·환불 및 웹훅 처리가 추가로 필요합니다.

## 혼잡도와 준비시간 모델

혼잡도는 0~99 범위의 소비자용 상대 지수입니다.

```text
혼잡도 = 45 × 대기열 압력
       + 35 × 최근 15분 유입 압력
       + 20 × 현장 유입 압력
```

- 대기열 압력: `현재 대기 주문 ÷ 15분 처리 가능 주문`
- 유입 압력: `최근 15분 주문 ÷ 15분 처리 가능 주문`
- 현장 유입 압력: `현장 체류·앱 관심 고객 ÷ 기준 유입량`

예상 준비시간은 아래처럼 계산합니다.

```text
기본 ETA = 메뉴 기본 조리시간 + ceil(대기 주문 ÷ 5분 처리량) × 5분
주문 ETA = 기본 ETA + 주문 메뉴별 조리 가중치 보정
```

현재 저장소에는 동작 확인용 샘플 센싱 데이터가 들어 있습니다. 운영 환경에서는 POS 주문 상태, 주문 완료 시각, 앱 위치 이벤트를 서버 DB에 누적하고 최근 15분 이동창으로 집계해야 합니다.

## API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/api/orders` | 서버 가격·ETA 검증 후 주문 생성 |
| `GET` | `/api/orders/:orderId` | 주문 상태 조회 |
| `POST` | `/api/payments/confirm` | 토스페이먼츠 결제 승인 |

현재 서버는 단일 VPS·노트북에서도 결제 리다이렉트 사이 주문이 유실되지 않도록 `.runtime/orders.json`에 원자적으로 저장합니다. 다중 서버 운영에서는 PostgreSQL/Supabase 등 공유 DB, 사용자 인증, 트럭 운영자 주문 큐, 결제 웹훅의 멱등 처리를 연결해야 합니다.

## 테스트

```bash
npm test
```

Playwright 테스트가 데스크톱·모바일 UI, 메뉴 담기, 네이버페이 선택, 데모 결제, 픽업 번호, 서버 금액 재계산을 확인합니다. 테스트 화면은 `artifacts/`에 저장됩니다.

## 주요 파일

- `index.html`, `styles.css`, `app.js`: 고객용 반응형 웹앱
- `data.js`: 트럭·메뉴 데이터와 혼잡도 계산식
- `server.mjs`: 정적 파일, 주문, 결제 승인 API 서버
- `payment-success.html`: 결제 승인·주문 저장
- `payment-fail.html`: 결제 실패 안내
- `test-server.mjs`: 브라우저 및 API 회귀 테스트
