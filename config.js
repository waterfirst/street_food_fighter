// GitHub Pages에서는 안전한 데모 결제로 동작합니다.
// 운영 환경에서는 이 파일을 배포 단계에서 덮어쓰고, 시크릿 키는 반드시 서버 환경변수로만 설정하세요.
window.SFF_CONFIG = window.SFF_CONFIG || {
  paymentMode: 'demo',
  tossClientKey: '',
  apiBaseUrl: ''
};
