import test from 'node:test';
import assert from 'node:assert/strict';

import {
  READER10_PERSONAS,
  aggregateReader10,
  evaluateReader10,
  evaluateReader10Payload,
  extractReadableText,
  runReader10,
} from '../src/reader10.mjs';

const clearHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>배포 준비 보고서</title>
</head>
<body>
  <main>
    <h1>배포 준비 보고서</h1>
    <section>
      <h2>핵심 요약</h2>
      <p>이 보고서의 목적은 새 버전을 안전하게 배포하도록 준비 상태와 검증 근거를 알려주는 것입니다.</p>
      <p>검증 10개가 모두 통과했으므로 담당자는 다음 단계를 실행할 수 있습니다.</p>
    </section>
    <section>
      <h2>준비 조건</h2>
      <ul><li>먼저 작업 파일을 저장합니다.</li><li>담당자가 변경 내용을 확인합니다.</li></ul>
    </section>
    <section>
      <h2>실행 단계</h2>
      <ol><li>검증 명령을 실행하세요.</li><li>결과를 확인하세요.</li><li>변경 사항을 게시하세요.</li></ol>
    </section>
    <section>
      <h2>실패 시 대안</h2>
      <p>오류가 발생하면 게시를 중단하고 이전 버전으로 복구하세요.</p>
      <p>자세한 근거는 <a href="https://example.com/release">배포 검증 기록</a>에서 확인할 수 있습니다.</p>
    </section>
  </main>
</body>
</html>`;

test('Reader-10 exposes exactly ten named deterministic personas', () => {
  assert.equal(READER10_PERSONAS.length, 10);
  assert.equal(new Set(READER10_PERSONAS.map((persona) => persona.id)).size, 10);
  assert.ok(READER10_PERSONAS.every((persona) => persona.name && persona.description));
});

test('extractReadableText removes active content and preserves readable structure', () => {
  const text = extractReadableText('<h1>제목 &amp; 결과</h1><script>steal()</script><ul><li>첫 단계</li></ul>');
  assert.match(text, /제목 & 결과/);
  assert.match(text, /- 첫 단계/);
  assert.doesNotMatch(text, /steal/);
});

test('evaluateReader10 passes a structured and actionable Korean report', () => {
  const result = evaluateReader10(clearHtml);
  assert.equal(result.mode, 'deterministic');
  assert.equal(result.totalPersonas, 10);
  assert.equal(result.criticalCount, 0);
  assert.ok(result.passedPersonas >= 9, `expected at least 9 passes, received ${result.passedPersonas}`);
  assert.equal(result.passed, true);
  assert.equal(runReader10(clearHtml).passed, true);
});

test('evaluateReader10 rejects empty content and unsafe active embeds', () => {
  const empty = evaluateReader10('');
  assert.equal(empty.passed, false);
  assert.ok(empty.criticalIssues.some((issue) => issue.code === 'empty-content'));

  const embedded = evaluateReader10('<html lang="ko"><main><h1>요약</h1><iframe src="https://example.com"></iframe></main></html>');
  assert.equal(embedded.passed, false);
  assert.ok(embedded.criticalIssues.some((issue) => issue.code === 'active-embed'));
});

test('missing image alternative text is a critical Reader-10 failure', () => {
  const result = evaluateReader10(clearHtml.replace('</main>', '<img src="chart.png"></main>'));
  assert.equal(result.passed, false);
  assert.ok(result.criticalIssues.some((issue) => issue.checkId === 'alt'));
});

test('aggregateReader10 requires at least nine passes and no critical issues', () => {
  const results = Array.from({ length: 10 }, (_, index) => ({
    id: `reader-${index}`,
    passed: index !== 9,
    checks: [],
  }));
  assert.deepEqual(
    aggregateReader10(results),
    {
      passed: true,
      pass: true,
      status: 'pass',
      minPass: 9,
      totalPersonas: 10,
      passedPersonas: 9,
      failedPersonas: 1,
      criticalCount: 0,
      criticalIssues: [],
    },
  );

  const blocked = aggregateReader10(results, {
    criticalIssues: [{ code: 'unsafe', message: '위험한 내용' }],
  });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.criticalCount, 1);
});

test('payload audit rejects an unrelated summary even when a report template would look complete', () => {
  const result = evaluateReader10Payload({
    task: '고양이 건강 상태를 조사해줘',
    summary: '바나나는 노란색 과일이라는 결과를 정리했습니다.',
    evidence: ['https://example.com'],
    risks: ['자료가 오래되면 다시 확인해야 합니다.'],
    nextSteps: ['수의사에게 확인하세요.'],
  });
  assert.equal(result.passed, false);
  assert.ok(result.criticalIssues.some((issue) => issue.code === 'task-summary-misalignment'));
});

test('payload audit passes aligned content but does not claim semantic proof', () => {
  const result = evaluateReader10Payload({
    task: 'Relay10 CLI 구현 결과를 조사하고 검증해줘',
    summary: 'Relay10 CLI 구현 결과와 테스트 상태를 조사해 정리했습니다. 오류가 나면 검증 로그를 확인하세요.',
    evidence: ['https://github.com/example/rein'],
    verification: ['33개 테스트 통과'],
    risks: ['배포 전 사람이 변경 내용을 확인해야 합니다.'],
    nextSteps: ['npm test를 실행하고 결과를 확인하세요.'],
  });
  assert.equal(result.passed, true);
  assert.equal(result.semanticVerified, false);
});
