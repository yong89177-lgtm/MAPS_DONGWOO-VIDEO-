const { createStore } = require('./jsonStore');
const { hashPassword } = require('./passwords');

// 메인 화면(HTML)의 FALLBACK 카탈로그와 동일한 초기 카테고리/항목 구성.
// AI Agent 등록이 2차 승인되면 해당 카테고리(team) 컬럼에 카드가 추가된다.
const SEED_COLUMNS = [
  {
    team: '新 공정/공법 개발',
    tag: 'New Process & Method Development',
    items: [
      { name: '공정 조건 최적화 Agent', desc: '실험 데이터 기반 최적 조건 탐색', owner: '', addr: '', order: 1, org: '전극기술그룹', likes: 34 },
      { name: '신공법 사례 조사 Agent', desc: '특허·논문에서 유사 공법 자동 수집', owner: '', addr: '', order: 2, org: '전극기술그룹', likes: 21 },
      { name: '설비 사양 검토 Agent', desc: '신규 설비 요구사양 초안 작성', owner: '', addr: '', order: 3, org: '파우치/각형기술그룹', likes: 18 },
      { name: '공법 변경 영향 예측', desc: '변경 시 품질·수율 파급 범위 추정', owner: '', addr: '', order: 4, org: '원통형기술그룹', likes: 27 },
      { name: '파일럿 결과 요약 Agent', desc: '시험 로트 결과 자동 정리·비교', owner: '', addr: '', order: 5, org: '파우치/각형기술그룹', likes: 15 },
      { name: '공정 표준서 초안 생성', desc: '검증 완료 조건을 표준 문서로 변환', owner: '', addr: '', order: 6, org: '전극기술그룹', likes: 9 },
    ],
  },
  {
    team: '해외법인 양산 지원',
    tag: 'Overseas Plant Production Support',
    items: [
      { name: '해외법인 수율 모니터링', desc: '법인별 수율 추이·이상 구간 알림', owner: '', addr: '', order: 1, org: 'Pack기술그룹', likes: 41 },
      { name: '현지 이슈 원인분석 Agent', desc: '불량 발생 구간 역추적 · 원인 후보 제시', owner: '', addr: '', order: 2, org: '원통형기술그룹', likes: 38 },
      { name: '설비 알람 대응 가이드', desc: '알람 이력 기반 조치 절차 자동 안내', owner: '', addr: '', order: 3, org: '파우치/각형기술그룹', likes: 24 },
      { name: '양산 조건 이관 점검', desc: '국내 조건과 현지 조건 차이 자동 대조', owner: '', addr: '', order: 4, org: '전극기술그룹', likes: 17 },
      { name: '현지 교육자료 생성 Agent', desc: '공정 문서를 현지어 교육안으로 변환', owner: '', addr: '', order: 5, org: '인프라그룹', likes: 12 },
      { name: '법인 간 실적 비교', desc: '동일 공정 지표를 법인별로 정렬 비교', owner: '', addr: '', order: 6, org: 'Pack기술그룹', likes: 8 },
    ],
  },
  {
    team: '제품 개발 대응',
    tag: 'Product Development Response',
    items: [
      { name: '개발 요구사양 정리 Agent', desc: '고객 요구를 검증 항목으로 분해', owner: '', addr: '', order: 1, org: 'Pack기술그룹', likes: 33 },
      { name: '설계 변경 영향 분석', desc: '변경 파급 범위와 재검증 항목 자동 추적', owner: '', addr: '', order: 2, org: '원통형기술그룹', likes: 29 },
      { name: '개발 일정 리스크 경보', desc: '마일스톤 지연 위험 사전 탐지', owner: '', addr: '', order: 3, org: 'Pack기술그룹', likes: 22 },
      { name: '시험 결과 판정 지원', desc: '규격 대비 합부 자동 판정 · 근거 제시', owner: '', addr: '', order: 4, org: '파우치/각형기술그룹', likes: 19 },
      { name: '과거 개발 이력 검색', desc: '유사 과제의 판단 근거를 찾아 제시', owner: '', addr: '', order: 5, org: '인프라그룹', likes: 14 },
    ],
  },
  {
    team: '공통 및 루틴 업무',
    tag: 'Common & Routine Operations',
    items: [
      { name: '회의록 자동 정리 Agent', desc: '녹취·메모를 결정사항과 액션으로 분리', owner: '', addr: '', order: 1, org: '인프라그룹', likes: 45 },
      { name: '보고서 초안 생성 Agent', desc: '데이터에서 주간·월간 보고 초안 작성', owner: '', addr: '', order: 2, org: '인프라그룹', likes: 36 },
      { name: '사내 문서 통합 검색', desc: '흩어진 규정·표준·보고서를 한 번에 검색', owner: '', addr: '', order: 3, org: '인프라그룹', likes: 31 },
      { name: '데이터 취합 자동화', desc: '반복 집계 작업을 정해진 양식으로 출력', owner: '', addr: '', order: 4, org: 'Pack기술그룹', likes: 26 },
      { name: '번역·요약 지원 Agent', desc: '기술 문서 번역과 핵심 요약', owner: '', addr: '', order: 5, org: '인프라그룹', likes: 20 },
    ],
  },
];

function seedAccounts() {
  const now = new Date().toISOString();
  const superId = process.env.ADMIN_ID || 'admin';
  const superPw = process.env.ADMIN_PASSWORD || 'admin1234';
  const secondId = process.env.ADMIN2_ID || 'admin2';
  const secondPw = process.env.ADMIN2_PASSWORD || 'admin1234';
  return [
    { id: superId, pw: hashPassword(superPw), role: 'admin', name: '1차(IT) 관리자', org: '', empno: '', createdAt: now },
    { id: secondId, pw: hashPassword(secondPw), role: 'admin', name: '2차(적절성) 관리자', org: '', empno: '', createdAt: now },
  ];
}

const accounts = createStore('accounts.json', seedAccounts);
const signupRequests = createStore('signup-requests.json', () => []);
const dashRequests = createStore('dash-requests.json', () => []);
const dashboards = createStore('dashboards.json', () => ({ columns: SEED_COLUMNS }));

module.exports = { accounts, signupRequests, dashRequests, dashboards, SEED_COLUMNS };
