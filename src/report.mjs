const STATUS_LABELS = Object.freeze({
  pass: '통과',
  fail: '실패',
  warn: '주의',
  neutral: '정보',
});

/** Escape untrusted content for an HTML text or quoted-attribute context. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Allow only navigation fragments and ordinary web/email links. */
export function sanitizeUrl(value) {
  const url = String(value ?? '').trim();
  if (/^#[a-z][\w:.-]*$/i.test(url)) return url;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  return '#';
}

function safeId(value, fallback = 'section') {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

function normalizeStatus(value) {
  const status = String(value ?? '').toLowerCase();
  if (['pass', 'passed', 'ok', 'success', 'succeeded', 'complete', 'completed', 'done', 'true'].includes(status)) return 'pass';
  if (['fail', 'failed', 'error', 'blocked', 'false'].includes(status)) return 'fail';
  if (['warn', 'warning', 'running', 'partial', 'skipped', 'pending', 'waiting'].includes(status)) return 'warn';
  return 'neutral';
}

function statusBadge(value, explicitLabel) {
  const status = normalizeStatus(value);
  const label = explicitLabel || (value === 'waiting' ? '답변 대기' : STATUS_LABELS[status]);
  return `<span class="status status--${status}"><span aria-hidden="true">${status === 'pass' ? '●' : status === 'fail' ? '×' : status === 'warn' ? '▲' : 'i'}</span> ${escapeHtml(label)}</span>`;
}

function executionBadge(enabled) {
  if (enabled === true) return statusBadge('pass', '실행');
  if (enabled === false) return statusBadge('skipped', '건너뜀');
  return statusBadge('neutral', '미기록');
}

function routingDecisionBadge(item) {
  const decision = item?.decision;
  if (decision === 'invoke') return statusBadge('pass', '호출');
  if (decision === 'skip') return statusBadge('skipped', '생략');
  if (decision === 'budget-blocked') return statusBadge('fail', '예산 부족');
  if (decision === 'pending') return statusBadge('warn', '판단 대기');
  return executionBadge(item?.enabled);
}

function routingBudget(value) {
  if (!value || typeof value !== 'object') return '-';
  const parts = [];
  if (Number.isInteger(value.usedBefore) && Number.isInteger(value.budget)) {
    parts.push(`판단 전 ${value.usedBefore}/${value.budget}회`);
  }
  if (Number.isInteger(value.mandatoryRemaining)) {
    parts.push(`필수 잔여 ${value.mandatoryRemaining}회`);
  }
  if (Number.isInteger(value.advisorInvocations)) {
    parts.push(`조언 ${value.advisorInvocations}회`);
  }
  if (Number.isInteger(value.requiredTotal)) {
    parts.push(`필요 합계 ${value.requiredTotal}회`);
  }
  return parts.join(' · ') || '-';
}

function routingEvidence(item) {
  const value = item?.evidence;
  const parts = [];
  if (item?.reasonCode) parts.push(`코드 ${item.reasonCode}`);
  if (value?.assessment?.role) parts.push(`초기 역할 ${value.assessment.role}`);
  if (Number.isFinite(value?.assessment?.score)) parts.push(`점수 ${value.assessment.score}`);
  if (Number.isInteger(value?.scout?.openQuestionCount)) {
    parts.push(`미해결 질문 ${value.scout.openQuestionCount}개`);
  }
  return parts.join(' · ') || '-';
}

function normalizeList(value, valueKey = 'value') {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return value == null ? [] : [value];
  return Object.entries(value).map(([name, item]) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return { name, ...item };
    return { name, [valueKey]: item };
  });
}

function safeStringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (key, item) => {
      if (typeof item === 'bigint') return `${item}n`;
      if (typeof item === 'object' && item !== null) {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    }, 2);
  } catch {
    return String(value ?? '');
  }
}

function renderText(value, className = '') {
  if (value == null || value === '') return '<p class="muted">기록 없음</p>';
  if (typeof value !== 'string') return `<pre class="data ${className}"><code>${escapeHtml(safeStringify(value))}</code></pre>`;
  const paragraphs = value.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p class="muted">기록 없음</p>';
  return paragraphs.map((paragraph) => `<p class="${escapeHtml(className)}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('\n');
}

function renderKeyValue(items) {
  const entries = Object.entries(items).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '<p class="muted">기록 없음</p>';
  return `<dl class="facts">${entries.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(typeof value === 'object' ? safeStringify(value) : value)}</dd></div>`).join('')}</dl>`;
}

function renderRouting(routing) {
  const rows = normalizeList(routing?.decisions ?? routing?.routes ?? routing);
  if (!rows.length) return '<p class="muted">모델 배정 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="모델 배정 표">
    <table>
      <thead><tr><th scope="col">단계</th><th scope="col">판단</th><th scope="col">역할</th><th scope="col">노력</th><th scope="col">모델</th><th scope="col">근거</th><th scope="col">호출 횟수</th><th scope="col">이유</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { value: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.stage ?? item.name ?? item.id ?? `단계 ${index + 1}`)}</th>
          <td>${routingDecisionBadge(item)}</td>
          <td>${escapeHtml(item.profile ?? item.tier ?? item.capability ?? '-')}</td>
          <td>${escapeHtml(item.effort ?? item.reasoning ?? '-')}</td>
          <td>${escapeHtml(item.model ?? item.providerModel ?? '-')}</td>
          <td>${escapeHtml(routingEvidence(item))}</td>
          <td>${escapeHtml(routingBudget(item.budget))}</td>
          <td>${escapeHtml(item.reason ?? item.rationale ?? item.value ?? '-')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderHarnessComparison(comparison) {
  const rows = normalizeList(comparison);
  if (!rows.length) return '<p class="muted">하네스 비교 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="다른 도구에서 가져온 것">
    <table class="wide-table">
      <thead><tr><th scope="col">도구</th><th scope="col">장점</th><th scope="col">단점</th><th scope="col">가져온 것</th><th scope="col">남긴 것</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { name: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.name ?? item.harness ?? item.project ?? `하네스 ${index + 1}`)}</th>
          <td>${escapeHtml(item.strengths ?? item.pros ?? '-')}</td>
          <td>${escapeHtml(item.weaknesses ?? item.cons ?? '-')}</td>
          <td>${escapeHtml(item.adopted ?? item.cherryPicked ?? '-')}</td>
          <td>${escapeHtml(item.excluded ?? item.rejected ?? '-')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderSupportMatrix(matrix) {
  const rows = normalizeList(matrix);
  if (!rows.length) return '<p class="muted">공급자와 앱 지원 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="공급자와 앱 지원 범위 표">
    <table class="support-table">
      <thead><tr><th scope="col">대상</th><th scope="col">현재 상태</th><th scope="col">근거</th><th scope="col">지원하려면 필요한 것</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { target: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.target ?? item.surface ?? item.provider ?? `대상 ${index + 1}`)}</th>
          <td>${statusBadge(item.status, item.current ?? item.label)}</td>
          <td>${escapeHtml(item.reason ?? item.evidence ?? '-')}</td>
          <td>${escapeHtml(item.required ?? item.path ?? item.next ?? '-')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderGlobalRepos(repositories) {
  const rows = normalizeList(repositories);
  if (!rows.length) return '<p class="muted">글로벌 저장소 조사 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="2026년 7월에 본 저장소">
    <table class="wide-table">
      <thead><tr><th scope="col">프로젝트</th><th scope="col">현재 신호</th><th scope="col">강점</th><th scope="col">약점·주의</th><th scope="col">Decant 채택</th><th scope="col">Decant 제외</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { name: row };
        const rawUrl = item.url ?? item.repository;
        const safeUrl = sanitizeUrl(rawUrl);
        const label = escapeHtml(item.name ?? item.project ?? `프로젝트 ${index + 1}`);
        const project = safeUrl === '#' ? label : `<a href="${escapeHtml(safeUrl)}" rel="noreferrer noopener">${label}</a>`;
        return `<tr>
          <th scope="row">${project}</th>
          <td>${escapeHtml(item.signal ?? item.stars ?? item.status ?? '-')}</td>
          <td>${escapeHtml(item.strengths ?? item.pros ?? '-')}</td>
          <td>${escapeHtml(item.cautions ?? item.weaknesses ?? item.cons ?? '-')}</td>
          <td>${escapeHtml(item.adopted ?? item.distilled ?? '-')}</td>
          <td>${escapeHtml(item.excluded ?? item.rejected ?? '-')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderSkillPack(skills) {
  const rows = normalizeList(skills);
  if (!rows.length) return '<p class="muted">스킬 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="스킬 여덟 개">
    <table class="support-table">
      <thead><tr><th scope="col">스킬</th><th scope="col">하는 일</th><th scope="col">참고한 방식</th><th scope="col">하지 않는 일</th><th scope="col">상태</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { name: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.name ?? item.skill ?? `스킬 ${index + 1}`)}</th>
          <td>${escapeHtml(item.job ?? item.purpose ?? '-')}</td>
          <td>${escapeHtml(item.patterns ?? item.sources ?? '-')}</td>
          <td>${escapeHtml(item.boundary ?? item.limit ?? '-')}</td>
          <td>${statusBadge(item.status ?? 'neutral', item.current ?? item.label)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderGrowthPlan(plan) {
  const rows = normalizeList(plan);
  if (!rows.length) return '<p class="muted">성장 계획이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="30일 60일 90일 성장 계획 표">
    <table class="wide-table">
      <thead><tr><th scope="col">기간</th><th scope="col">제품</th><th scope="col">증명</th><th scope="col">홍보·커뮤니티</th><th scope="col">판단 지표</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { period: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.period ?? item.name ?? `${index + 1}단계`)}</th>
          <td>${escapeHtml(item.product ?? '-')}</td>
          <td>${escapeHtml(item.proof ?? item.evidence ?? '-')}</td>
          <td>${escapeHtml(item.promotion ?? item.community ?? '-')}</td>
          <td>${escapeHtml(item.metric ?? item.kpi ?? '-')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderEvidence(evidence) {
  const rows = normalizeList(evidence, 'url');
  if (!rows.length) return '<p class="muted">연결된 근거가 없습니다.</p>';
  return `<ol class="evidence-list">${rows.map((item, index) => {
    const evidenceItem = item && typeof item === 'object' ? item : { title: String(item) };
    const label = evidenceItem.title ?? evidenceItem.label ?? evidenceItem.name ?? `근거 ${index + 1}`;
    const rawUrl = evidenceItem.url ?? evidenceItem.href ?? evidenceItem.source;
    const safeUrl = sanitizeUrl(rawUrl);
    const linkedLabel = safeUrl === '#'
      ? `<span>${escapeHtml(label)}</span>`
      : `<a href="${escapeHtml(safeUrl)}" rel="noreferrer noopener">${escapeHtml(label)}</a>`;
    const note = evidenceItem.note ?? evidenceItem.excerpt ?? evidenceItem.description;
    return `<li>${linkedLabel}${note ? `<p>${escapeHtml(note)}</p>` : ''}${rawUrl && safeUrl === '#' ? '<p class="muted">안전하지 않거나 지원하지 않는 URL은 생략했습니다.</p>' : ''}</li>`;
  }).join('')}</ol>`;
}

function normalizeStages(data) {
  return normalizeList(data.stages ?? data.stageOutputs ?? data.outputs);
}

function renderStages(data) {
  const stages = normalizeStages(data);
  if (!stages.length) return '<p class="muted">단계별 출력이 없습니다.</p>';
  return `<div class="stage-list">${stages.map((stage, index) => {
    const item = stage && typeof stage === 'object' ? stage : { output: stage };
    const title = item.title ?? item.name ?? item.stage ?? item.id ?? `단계 ${index + 1}`;
    const status = item.status ?? item.passed;
    const metadata = {
      프로필: item.profile ?? item.tier,
      모델: item.model,
      소요시간: item.duration ?? item.durationMs,
      비용: item.cost ?? item.costUsd,
    };
    return `<article class="stage" aria-labelledby="stage-${index}">
      <header><div><p class="eyebrow">단계 ${index + 1}</p><h3 id="stage-${index}">${escapeHtml(title)}</h3></div>${status !== undefined ? statusBadge(status, item.statusLabel) : ''}</header>
      ${item.summary ? `<div class="stage-summary">${renderText(item.summary)}</div>` : ''}
      ${renderKeyValue(metadata)}
      <details${index === 0 ? ' open' : ''}><summary>출력 보기</summary>${renderText(item.output ?? item.result ?? item.value ?? item.data, 'stage-output')}</details>
      ${item.evidence ? `<div class="nested-evidence"><h3>단계 근거</h3>${renderEvidence(item.evidence)}</div>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function normalizeVerification(verification) {
  if (Array.isArray(verification)) return verification;
  if (!verification || typeof verification !== 'object') return verification == null ? [] : [verification];
  if (Array.isArray(verification.checks)) return verification.checks;
  return normalizeList(verification);
}

function renderVerification(verification) {
  const checks = normalizeVerification(verification);
  if (!checks.length) return '<p class="muted">검증 기록이 없습니다.</p>';
  return `<ul class="check-list">${checks.map((checkItem, index) => {
    const item = checkItem && typeof checkItem === 'object' ? checkItem : { name: `검증 ${index + 1}`, value: checkItem };
    const state = item.passed ?? item.pass ?? item.status ?? item.value;
    const name = item.name ?? item.label ?? item.id ?? `검증 ${index + 1}`;
    const detail = item.detail ?? item.message ?? item.output;
    return `<li><div>${statusBadge(state)}<strong>${escapeHtml(name)}</strong></div>${detail != null ? `<p>${escapeHtml(typeof detail === 'object' ? safeStringify(detail) : detail)}</p>` : ''}</li>`;
  }).join('')}</ul>`;
}

function renderReader10(reader) {
  if (!reader || typeof reader !== 'object') return '<p class="muted">Reader-10 검수 결과가 없습니다.</p>';
  const personas = Array.isArray(reader.personas) ? reader.personas : [];
  const passed = reader.passedPersonas ?? personas.filter((item) => item.passed).length;
  const total = reader.totalPersonas ?? personas.length ?? 10;
  const critical = reader.criticalCount ?? reader.criticalIssues?.length ?? 0;
  const overall = reader.passed ?? reader.pass ?? reader.status;
  const mode = reader.mode ?? 'unknown';
  const isDeterministic = mode.startsWith('deterministic');
  const isPendingLive = mode === 'pending-live';
  const passUnit = isDeterministic ? '자동 구조 프로필' : mode === 'live' ? '실제 모델 독자 역할' : '검수 항목';
  const modeDescription = isDeterministic
    ? '자동 구조 모드: 모델을 호출하지 않고 문서 구조, 길이, 용어, 링크, 행동 신호와 접근성 규칙만 검사합니다. 아래 점수는 실제 모델 독자 점수가 아니며 의미 이해나 사실 정확성을 증명하지 않습니다.'
    : isPendingLive
      ? '판독 대기 모드: 이 문서가 완성된 뒤 실제 모델 독자 10회 판독을 실행합니다. 이 상태는 제품 출시 보류를 뜻하지 않습니다. 최종 결과는 이 문서의 해시와 연결한 별도 기록에 남깁니다.'
    : mode === 'live'
      ? '라이브 모드: 10개 독자 역할을 각각 별도 모델 호출로 평가합니다. 호출 실패도 실패로 집계될 수 있으며, 모델 간 독립성이나 사실 정확성을 증명하지 않습니다.'
      : '검수 모드가 기록되지 않았습니다. 이 결과만으로 검사 방식이나 의미 이해를 추정할 수 없습니다.';
  return `<p class="reader-mode"><strong>검수 방식:</strong> ${escapeHtml(modeDescription)}</p>
    <div class="reader-summary">
      <div>${statusBadge(overall)}<strong>${escapeHtml(isPendingLive ? '실제 모델 10회 판독 전' : `${passed}/${total} ${passUnit} 통과`)}</strong></div>
      <p>${escapeHtml(isPendingLive ? `완료 조건 ${reader.minPass ?? 10}/${total || 10} 이해 · 치명적 문제 0개 · HTML 해시 일치` : `치명적 문제 ${critical}개 · 요구 기준 ${reader.minPass ?? 9}/${total || 10}`)}</p>
    </div>${personas.length ? `
    <ul class="persona-grid">${personas.map((persona) => {
      const failures = (persona.checks ?? []).filter((item) => !item.passed);
      return `<li>
        <div>${statusBadge(persona.passed)}<strong>${escapeHtml(persona.name ?? persona.id)}</strong></div>
        ${persona.description ? `<p>${escapeHtml(persona.description)}</p>` : ''}
        ${failures.length ? `<details><summary>개선점 ${failures.length}개</summary><ul>${failures.map((failure) => `<li>${escapeHtml(failure.detail ?? failure.label ?? failure.id)}</li>`).join('')}</ul></details>` : '<p class="muted">발견된 이해도 문제가 없습니다.</p>'}
      </li>`;
    }).join('')}</ul>` : ''}${reader.criticalIssues?.length ? `
    <aside class="critical" aria-label="치명적 문제"><h3>치명적 문제</h3><ul>${reader.criticalIssues.map((issue) => `<li>${escapeHtml(issue.message ?? issue.code ?? issue)}</li>`).join('')}</ul></aside>` : ''}`;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function renderNextSteps(nextSteps) {
  const steps = normalizeList(nextSteps, 'text');
  if (!steps.length) return '<p class="muted">추가 조치가 필요하지 않거나 아직 기록되지 않았습니다.</p>';
  return `<ol>${steps.map((step) => {
    const text = step && typeof step === 'object' ? step.text ?? step.title ?? step.name ?? step.value : step;
    return `<li>${escapeHtml(text ?? '')}</li>`;
  }).join('')}</ol>`;
}

/**
 * Render a self-contained, accessible Korean HTML run report.
 * Every value supplied by the caller is escaped; stage output is never trusted as HTML.
 */
export function generateReport(data = {}, options = {}) {
  const title = data.title ?? options.title ?? 'Decant 실행 보고서';
  const summary = data.summary ?? data.resultSummary ?? '요약이 아직 기록되지 않았습니다.';
  const heroSummary = data.heroSummary ?? summary;
  const task = data.task ?? data.request ?? data.goal ?? '요청 내용이 기록되지 않았습니다.';
  const runId = data.runId ?? data.id ?? 'unknown';
  const generatedAt = normalizeDate(data.generatedAt ?? options.generatedAt);
  const overallStatus = data.status ?? data.passed ?? data.verification?.passed ?? 'neutral';
  const reader = data.reader10 ?? data.readerResults ?? data.reader;
  const evidence = data.evidence ?? data.sources ?? data.provenance;
  const nextSteps = data.nextSteps ?? data.actions;
  const comparisons = data.comparisons ?? data.harnessComparison;
  const supportMatrix = data.supportMatrix ?? data.portability;
  const globalRepos = data.globalRepos ?? data.globalRepositories;
  const skillPack = data.skillPack ?? data.skills;
  const growthPlan = data.growthPlan ?? data.roadmap;
  const hasComparisons = normalizeList(comparisons).length > 0;
  const hasSupportMatrix = normalizeList(supportMatrix).length > 0;
  const hasGlobalRepos = normalizeList(globalRepos).length > 0;
  const hasSkillPack = normalizeList(skillPack).length > 0;
  const hasGrowthPlan = normalizeList(growthPlan).length > 0;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; --bg:#f5f5f7; --panel:#fff; --text:#1d1d1f; --muted:#6e6e73; --line:#d2d2d7; --accent:#0066cc; --pass:#248a3d; --fail:#d70015; --warn:#b25000; --info:#6e6e73; --code:#1d1d1f; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Apple SD Gothic Neo","Pretendard","Segoe UI",sans-serif; font-size:17px; line-height:1.5; letter-spacing:-.01em; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
    a { color:var(--accent); text-decoration-thickness:1px; text-underline-offset:.18em; }
    a:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .skip-link { position:absolute; top:-4rem; left:1rem; z-index:20; padding:.55rem .8rem; background:var(--panel); color:var(--text); }
    .skip-link:focus { top:1rem; }
    .shell { width:min(100% - 2.5rem, 920px); margin-inline:auto; }
    header.page { padding:3.2rem 0 1.2rem; }
    h1,h2,h3 { font-weight:650; line-height:1.2; letter-spacing:-.022em; }
    h1 { margin:0 0 .6rem; font-size:clamp(1.8rem,4vw,2.15rem); }
    h2 { margin:0 0 .85rem; font-size:1.25rem; }
    h3 { margin:.2rem 0 .4rem; font-size:1rem; font-weight:600; }
    .summary { max-width:62ch; margin:0; font-size:1.05rem; }
    .meta { display:flex; flex-wrap:wrap; gap:.4rem 1rem; margin-top:1rem; color:var(--muted); font-size:.92rem; }
    nav { position:sticky; top:0; z-index:10; background:color-mix(in srgb, var(--bg) 88%, transparent); border-bottom:1px solid var(--line); }
    nav ul { display:flex; gap:1rem; margin:0; padding:.7rem 0; list-style:none; overflow-x:auto; }
    nav a { color:var(--muted); font-size:.92rem; font-weight:500; white-space:nowrap; text-decoration:none; }
    nav a:hover { color:var(--text); }
    main { padding:1.4rem 0 4rem; }
    section { scroll-margin-top:4.2rem; margin:0 0 .7rem; padding:1.15rem 1.2rem 1.25rem; background:var(--panel); border-radius:12px; }
    .lede { font-size:1.02rem; }
    .status { margin-right:.45rem; font-size:.92rem; font-weight:600; }
    .status span[aria-hidden] { display:none; }
    .status--pass { color:var(--pass); } .status--fail { color:var(--fail); } .status--warn { color:var(--warn); } .status--neutral { color:var(--info); }
    .facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(11rem,1fr)); gap:0; margin:1rem 0 0; border-top:1px solid var(--line); }
    .facts div { padding:.7rem 0; border-bottom:1px solid var(--line); }
    .facts dt { color:var(--muted); font-size:.8rem; font-weight:500; }
    .facts dd { margin:.15rem 0 0; white-space:pre-wrap; }
    .table-wrap { max-width:100%; overflow:auto; }
    table { width:100%; border-collapse:collapse; min-width:40rem; font-size:.92rem; }
    .wide-table { min-width:68rem; }
    .support-table { min-width:52rem; }
    th,td { padding:.65rem .7rem .65rem 0; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
    thead th { color:var(--muted); font-size:.78rem; font-weight:500; }
    tbody tr:last-child th,tbody tr:last-child td { border-bottom:0; }
    .stage-list { display:grid; }
    .stage { padding:1rem 0; border-top:1px solid var(--line); }
    .stage:first-child { border-top:0; padding-top:0; }
    .stage > header { display:flex; justify-content:space-between; gap:1rem; align-items:baseline; }
    summary { cursor:pointer; font-weight:600; }
    details { margin-top:.6rem; }
    pre { max-width:100%; overflow:auto; margin:.6rem 0 0; padding:.85rem 0; background:transparent; color:var(--text); white-space:pre-wrap; word-break:break-word; font-size:.88rem; }
    .check-list,.persona-grid { padding:0; list-style:none; }
    .check-list > li, .persona-grid > li { padding:.75rem 0; border-top:1px solid var(--line); }
    .check-list p, .persona-grid p { margin:.3rem 0 0; color:var(--muted); }
    .reader-mode { margin:0 0 .8rem; }
    .reader-summary { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.6rem 1rem; padding:.8rem 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
    .reader-summary p { margin:0; color:var(--muted); }
    .critical { margin-top:1rem; }
    .critical h3 { color:var(--fail); }
    .evidence-list li + li { margin-top:.7rem; }
    .evidence-list p { margin:.1rem 0; color:var(--muted); }
    .muted { color:var(--muted); }
    footer { padding:0 0 3rem; color:var(--muted); font-size:.88rem; }
    @media (max-width:650px) { .shell { width:min(100% - 1.4rem, 920px); } header.page { padding:2rem 0 1rem; } .stage > header { display:block; } }
    @media (prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } }
    @media print { nav,.skip-link { display:none; } body { background:#fff; color:#000; } section { break-inside:avoid; } }
    @media (prefers-color-scheme:dark) { :root { --bg:#000; --panel:#1c1c1e; --text:#f5f5f7; --muted:#98989d; --line:#38383a; --accent:#0a84ff; --pass:#30d158; --fail:#ff453a; --warn:#ff9f0a; --info:#98989d; --code:#f5f5f7; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <header class="page">
    <div class="shell">
      <h1>${escapeHtml(title)}</h1>
      <p class="summary">${escapeHtml(heroSummary)}</p>
      <div class="meta">${statusBadge(overallStatus)}<span>실행 번호 ${escapeHtml(runId)}</span><time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedAt)}</time></div>
    </div>
  </header>
  <nav aria-label="목차"><div class="shell"><ul>
    <li><a href="#overview">요약</a></li><li><a href="#routing">모델</a></li>${hasGlobalRepos ? '<li><a href="#global">참고한 저장소</a></li>' : ''}${hasSkillPack ? '<li><a href="#skills">스킬</a></li>' : ''}${hasComparisons ? '<li><a href="#comparison">가져온 것</a></li>' : ''}${hasSupportMatrix ? '<li><a href="#support">되는 것</a></li>' : ''}${hasGrowthPlan ? '<li><a href="#growth">다음 일</a></li>' : ''}<li><a href="#stages">기록</a></li><li><a href="#verification">검증</a></li><li><a href="#reader10">읽기 검사</a></li><li><a href="#evidence">근거</a></li><li><a href="#actions">다음</a></li>
  </ul></div></nav>
  <main id="main" class="shell">
    <section id="overview" aria-labelledby="overview-title"><h2 id="overview-title">목적과 결과 요약</h2><h3>요청</h3>${renderText(task, 'lede')}<h3>결과</h3>${renderText(summary, 'lede')}${renderKeyValue({ 상태: STATUS_LABELS[normalizeStatus(overallStatus)], 실행번호: runId, 만든시각: generatedAt })}</section>
    <section id="routing" aria-labelledby="routing-title"><h2 id="routing-title">모델 배정</h2><p>파일을 고치는 단계는 하나고, 나머지는 읽기만 합니다. 역할 이름은 그 컴퓨터의 모델 목록에서 고른 자리이고, 가격이나 순위를 뜻하지 않습니다.</p>${renderRouting(data.routing)}</section>
    ${hasGlobalRepos ? `<section id="global" aria-labelledby="global-title"><h2 id="global-title">2026년 7월에 본 저장소</h2>${renderText(data.globalSummary ?? '별 수는 인기와 발견 신호일 뿐 품질, 사용량, 성능을 증명하지 않습니다. 현재성, 구조, 테스트, 라이선스를 함께 봤습니다.')} ${renderGlobalRepos(globalRepos)}</section>` : ''}
    ${hasSkillPack ? `<section id="skills" aria-labelledby="skills-title"><h2 id="skills-title">스킬 여덟 개</h2>${renderText(data.skillSummary ?? '스킬은 한 가지 일만 하고, 그 일이 필요할 때만 읽습니다. 묶음으로 배포해도 지금 쓰는 모델이 바뀌지는 않습니다.')} ${renderSkillPack(skillPack)}</section>` : ''}
    ${hasComparisons ? `<section id="comparison" aria-labelledby="comparison-title"><h2 id="comparison-title">다른 도구에서 가져온 것</h2>${renderText(data.comparisonSummary ?? '코드를 복사하지 않았습니다. 확인되는 동작만 따로 만들었습니다.')} ${renderHarnessComparison(comparisons)}</section>` : ''}
    ${hasSupportMatrix ? `<section id="support" aria-labelledby="support-title"><h2 id="support-title">지금 되는 범위</h2>${renderText(data.supportSummary ?? '이미 연결된 것과, 연결은 안 했지만 공식 주소가 있는 것을 구분합니다.')} ${renderSupportMatrix(supportMatrix)}</section>` : ''}
    ${hasGrowthPlan ? `<section id="growth" aria-labelledby="growth-title"><h2 id="growth-title">다음에 할 일</h2>${renderText(data.growthSummary ?? '기능 수보다, 다시 돌려 볼 수 있는 성공과 실패를 먼저 남깁니다.')} ${renderGrowthPlan(growthPlan)}</section>` : ''}
    <section id="stages" aria-labelledby="stages-title"><h2 id="stages-title">단계별 기록</h2>${renderStages(data)}</section>
    <section id="verification" aria-labelledby="verification-title"><h2 id="verification-title">검증 결과</h2><p>실패하면 아래 기록과 다음 단계의 복구 방법을 먼저 봅니다.</p>${renderVerification(data.verification)}</section>
    <section id="reader10" aria-labelledby="reader10-title"><h2 id="reader10-title">Reader-10 검수</h2><p>문장이 읽히는지만 봅니다. 코드가 맞다는 뜻은 아닙니다.</p>${renderReader10(reader)}</section>
    <section id="evidence" aria-labelledby="evidence-title"><h2 id="evidence-title">근거와 출처</h2>${renderEvidence(evidence)}</section>
    <section id="actions" aria-labelledby="actions-title"><h2 id="actions-title">다음 단계</h2><p>순서대로 하고, 막히면 검증 기록의 오류부터 봅니다.</p>${renderNextSteps(nextSteps)}</section>
  </main>
  <footer class="shell"><p>이 파일만 열면 됩니다. 밖에서 글꼴이나 스타일을 받아 오지 않습니다.</p></footer>
</body>
</html>`;
}

export const renderReport = generateReport;
