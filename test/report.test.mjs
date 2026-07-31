import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateReader10 } from '../src/reader10.mjs';
import { escapeHtml, generateReport, renderReport, sanitizeUrl } from '../src/report.mjs';

const reportData = {
  title: 'Relay10 배포 준비',
  heroSummary: 'Codex CLI 지원, 다른 공급자와 앱 네이티브 통합은 아직 미지원입니다.',
  task: '이 보고서의 목적은 경량 하네스의 배포 준비 상태를 검증하고 다음 실행 단계를 안내하는 것입니다.',
  summary: '핵심 기능과 검증 10개가 통과했습니다. 담당자는 준비 조건을 확인한 뒤 게시 명령을 실행할 수 있습니다.',
  status: 'passed',
  runId: 'run-001',
  generatedAt: '2026-07-13T03:00:00.000Z',
  routing: [
    { stage: '자료 읽기', enabled: true, decision: 'invoke', profile: 'economy', effort: 'low', model: 'scout', reason: '구조화된 입력이라 자동 검증이 가능합니다.' },
    { stage: '분석과 계획', enabled: true, decision: 'skip', reasonCode: 'easy-no-open-questions', profile: 'frontier', effort: 'high', model: 'architect', evidence: { assessment: { role: 'economy', score: 3 }, scout: { openQuestionCount: 0 } }, budget: { usedBefore: 1, budget: 30, mandatoryRemaining: 3, advisorInvocations: 0 }, reason: '미해결 질문이 없어 고급 조언을 생략했습니다.' },
  ],
  comparisons: [
    { name: '예제 하네스', strengths: '설치가 쉽습니다.', weaknesses: '기능이 많습니다.', adopted: '진단 명령', excluded: '상시 실행 서버' },
  ],
  supportMatrix: [
    { target: 'Codex CLI', status: 'pass', current: '지원', reason: 'Codex 실행기를 사용합니다.', required: '추가 작업 없음' },
    { target: '다른 공급자', status: 'fail', current: '미지원', reason: '공급자 어댑터가 없습니다.', required: '실행 어댑터 구현' },
  ],
  globalRepos: [
    { name: 'Global Agent', url: 'https://example.com/agent', signal: '10,000 stars · MIT · active', strengths: '권한 분리', cautions: '큰 runtime', adopted: '단계별 권한', excluded: '상시 daemon' },
  ],
  skillPack: [
    { name: 'decant-research', job: '읽기 전용 근거 수집', patterns: 'progressive disclosure', boundary: '수정하지 않음', status: 'pass', current: '구현됨' },
  ],
  growthPlan: [
    { period: '30일', product: '실제 예제 3개', proof: '재현 로그', promotion: '짧은 데모', metric: '첫 성공률' },
  ],
  stages: [
    {
      name: '준비 조건 확인',
      status: 'completed',
      profile: 'economy',
      summary: '필요한 파일과 환경을 확인했습니다.',
      output: { files: 4, environment: 'Node 20 이상' },
    },
    {
      name: '구현과 검증',
      status: 'passed',
      profile: 'balanced',
      summary: '오류 없이 테스트를 마쳤습니다.',
      output: '검증 명령을 실행했고 모든 결과를 확인했습니다.',
    },
  ],
  verification: {
    checks: [
      { name: '구문 검사', passed: true, detail: '오류 없음' },
      { name: '단위 테스트', passed: true, detail: '10개 통과' },
    ],
  },
  reader10: {
    mode: 'deterministic',
    passed: true,
    minPass: 9,
    passedPersonas: 10,
    totalPersonas: 10,
    criticalCount: 0,
    personas: [
      { id: 'executive', name: '30초 독자', description: '결론부터 읽는 독자', passed: true, checks: [] },
    ],
  },
  evidence: [
    { title: '검증 기록', url: 'https://example.com/evidence', note: '테스트 결과의 근거입니다.' },
  ],
  nextSteps: ['먼저 변경 내용을 확인합니다.', '게시 명령을 실행합니다.', '문제가 생기면 이전 버전으로 복구합니다.'],
};

test('escapeHtml and sanitizeUrl reject HTML and executable URLs', () => {
  assert.equal(escapeHtml('<script>"x" & y</script>'), '&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '#');
  assert.equal(sanitizeUrl('data:text/html,bad'), '#');
  assert.equal(sanitizeUrl('https://example.com/a?q=1'), 'https://example.com/a?q=1');
  assert.equal(sanitizeUrl('#reader10'), '#reader10');
});

test('generateReport creates a self-contained, accessible Korean HTML report', () => {
  const html = generateReport(reportData);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<h1>Relay10 배포 준비<\/h1>/);
  assert.match(html, /핵심 요약:<\/strong> Codex CLI 지원, 다른 공급자와 앱 네이티브 통합은 아직 미지원입니다/);
  assert.match(html, /<th scope="col">단계<\/th>/);
  assert.match(html, /<th scope="col">라우팅 판단<\/th>/);
  assert.match(html, /> 호출<\/span>/);
  assert.match(html, /> 생략<\/span>/);
  assert.match(html, /코드 easy-no-open-questions · 초기 역할 economy · 점수 3 · 미해결 질문 0개/);
  assert.match(html, /판단 전 1\/30회 · 필수 잔여 3회 · 고급 조언 0회/);
  assert.match(html, /하네스별 장단점과 Decant 체리피킹/);
  assert.match(html, /Decant이 채택한 패턴/);
  assert.match(html, /현재 공급자·CLI·앱 지원 범위/);
  assert.match(html, /> 지원<\/span>/);
  assert.match(html, /> 미지원<\/span>/);
  assert.match(html, /글로벌 상위 저장소에서 무엇을 증류했나/);
  assert.match(html, /별 수는 인기와 발견 신호일 뿐/);
  assert.match(html, /여덟 개만 남긴 Decant Skill pack/);
  assert.match(html, /앞으로 30일·60일·90일에 할 일/);
  assert.match(html, /Reader-10 검수/);
  assert.match(html, /10\/10 자동 구조 프로필 통과/);
  assert.match(html, /자동 구조 모드: 모델을 호출하지 않고 HTML 구조/);
  assert.match(html, /의미 이해나 사실 정확성을 증명하지 않습니다/);
  assert.match(html, /https:\/\/example\.com\/evidence/);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<link\b[^>]*rel=["']stylesheet/i);
  assert.equal(renderReport(reportData), html);
});

test('generateReport labels live Reader-10 as ten model calls without claiming independence', () => {
  const html = generateReport({
    ...reportData,
    reader10: {
      ...reportData.reader10,
      mode: 'live',
    },
  });

  assert.match(html, /10개 독자 역할을 각각 별도 모델 호출로 평가합니다/);
  assert.match(html, /모델 간 독립성이나 사실 정확성을 증명하지 않습니다/);
  assert.match(html, /10\/10 실제 모델 독자 역할 통과/);
});

test('generateReport labels deterministic-structure as automatic rules, not model readers', () => {
  const html = generateReport({
    ...reportData,
    reader10: { ...reportData.reader10, mode: 'deterministic-structure' },
  });
  assert.match(html, /자동 구조 모드/);
  assert.match(html, /실제 모델 독자 점수가 아니며/);
  assert.match(html, /자동 구조 프로필 통과/);
});

test('generateReport presents pending live readers without implying execution or failure', () => {
  const html = generateReport({
    ...reportData,
    reader10: {
      mode: 'pending-live',
      status: 'warn',
      minPass: 10,
      passedPersonas: 0,
      totalPersonas: 10,
      criticalCount: 0,
      personas: [],
    },
  });
  assert.match(html, /판독 대기 모드/);
  assert.match(html, /실제 모델 10회 판독 전/);
  assert.match(html, /이 상태는 제품 출시 보류를 뜻하지 않습니다/);
  assert.doesNotMatch(html, /0\/10 검수 항목 통과/);
});

test('generateReport escapes every caller-provided HTML value and drops unsafe links', () => {
  const html = generateReport({
    ...reportData,
    title: '<img src=x onerror=alert(1)>',
    stages: [{ name: '<script>bad()</script>', output: '</code><script>bad()</script>' }],
    comparisons: [{ name: '<b>비교</b>', strengths: '<img src=x>', weaknesses: 'x', adopted: 'y', excluded: 'z' }],
    supportMatrix: [{ target: '<svg onload=bad()>', current: '미지원', status: 'fail', reason: '<script>bad()</script>', required: 'adapter' }],
    globalRepos: [{ name: '<img src=x>', url: 'javascript:bad()', strengths: '<script>bad()</script>' }],
    skillPack: [{ name: '<b>skill</b>', job: '<svg onload=bad()>' }],
    growthPlan: [{ period: '<script>bad()</script>', product: '<img src=x>' }],
    evidence: [{ title: '<b>위험 링크</b>', url: 'javascript:alert(1)' }],
  });
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<img\b/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /안전하지 않거나 지원하지 않는 URL은 생략했습니다/);
});

test('generated full report clears the deterministic Reader-10 gate', () => {
  const html = generateReport(reportData);
  const result = evaluateReader10(html);
  assert.equal(result.criticalCount, 0);
  assert.ok(result.passedPersonas >= 9, `expected readable report, received ${result.passedPersonas}/10`);
  assert.equal(result.passed, true);
});

test('report rendering tolerates circular structured output', () => {
  const output = { result: '완료' };
  output.self = output;
  const html = generateReport({ ...reportData, stages: [{ name: '순환 출력', output }] });
  assert.match(html, /\[Circular\]/);
});
