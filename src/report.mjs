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
  if (['warn', 'warning', 'running', 'partial', 'skipped', 'pending'].includes(status)) return 'warn';
  return 'neutral';
}

function statusBadge(value, explicitLabel) {
  const status = normalizeStatus(value);
  const label = explicitLabel || STATUS_LABELS[status];
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
    parts.push(`고급 조언 ${value.advisorInvocations}회`);
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
  if (!rows.length) return '<p class="muted">라우팅 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="모델 라우팅 표">
    <table>
      <thead><tr><th scope="col">단계</th><th scope="col">라우팅 판단</th><th scope="col">프로필</th><th scope="col">노력도</th><th scope="col">모델</th><th scope="col">판단 근거</th><th scope="col">호출 예산</th><th scope="col">선택 이유</th></tr></thead>
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
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="하네스 장단점과 Decant 체리피킹 표">
    <table class="wide-table">
      <thead><tr><th scope="col">하네스</th><th scope="col">장점</th><th scope="col">단점</th><th scope="col">Decant이 채택한 패턴</th><th scope="col">의도적으로 제외한 부분</th></tr></thead>
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
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="글로벌 상위 저장소 증류 표">
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
  if (!rows.length) return '<p class="muted">Skill pack 기록이 없습니다.</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="Decant Skill pack 표">
    <table class="support-table">
      <thead><tr><th scope="col">Skill</th><th scope="col">한 가지 일</th><th scope="col">증류한 패턴</th><th scope="col">경계</th><th scope="col">현재 상태</th></tr></thead>
      <tbody>${rows.map((row, index) => {
        const item = row && typeof row === 'object' ? row : { name: row };
        return `<tr>
          <th scope="row">${escapeHtml(item.name ?? item.skill ?? `Skill ${index + 1}`)}</th>
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
    ? '자동 구조 모드: 모델을 호출하지 않고 HTML 구조, 길이, 용어, 링크, 행동 신호와 접근성 규칙만 검사합니다. 아래 점수는 실제 모델 독자 점수가 아니며 의미 이해나 사실 정확성을 증명하지 않습니다.'
    : isPendingLive
      ? '판독 대기 모드: 이 HTML이 완성된 뒤 실제 모델 독자 10회 판독을 실행합니다. 이 상태는 제품 출시 보류를 뜻하지 않습니다. 최종 결과는 reportSha256으로 이 HTML과 연결한 별도 JSON에 기록합니다.'
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
    :root { color-scheme: light dark; --bg:#f5f6f8; --panel:#fff; --text:#17202a; --muted:#5d6876; --line:#dfe3e8; --accent:#315efb; --pass:#16794b; --fail:#b42318; --warn:#8a5700; --info:#52606d; --code:#101828; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; font-size:16px; line-height:1.7; overflow-wrap:anywhere; }
    a { color:var(--accent); text-underline-offset:.18em; }
    a:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
    .skip-link { position:absolute; top:-4rem; left:1rem; z-index:20; padding:.65rem 1rem; background:var(--panel); color:var(--text); border:2px solid var(--accent); }
    .skip-link:focus { top:1rem; }
    .shell { width:min(100% - 2rem, 1100px); margin-inline:auto; }
    .hero { padding:4rem 0 2rem; background:linear-gradient(135deg,#111827,#243b73); color:#fff; }
    .eyebrow { margin:0 0 .35rem; color:inherit; font-size:.78rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; opacity:.78; }
    h1,h2,h3 { line-height:1.25; letter-spacing:-.02em; }
    h1 { margin:.2rem 0 .7rem; font-size:clamp(2rem,5vw,3.6rem); }
    h2 { margin:0 0 1rem; font-size:clamp(1.45rem,3vw,2rem); }
    h3 { margin:.1rem 0 .55rem; font-size:1.08rem; }
    .hero-summary { max-width:72ch; font-size:1.08rem; }
    .meta { display:flex; flex-wrap:wrap; gap:.75rem 1.3rem; margin-top:1.3rem; align-items:center; }
    .meta span, .meta time { color:#d9e2f2; }
    nav { position:sticky; top:0; z-index:10; background:color-mix(in srgb,var(--panel) 94%,transparent); border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    nav ul { display:flex; gap:.35rem; margin:0; padding:.65rem 0; list-style:none; overflow-x:auto; }
    nav a { display:block; padding:.4rem .68rem; border-radius:.45rem; color:var(--text); font-weight:700; white-space:nowrap; text-decoration:none; }
    nav a:hover { background:var(--bg); }
    main { padding:2rem 0 5rem; }
    section { scroll-margin-top:5rem; margin:0 0 1.2rem; padding:clamp(1.1rem,3vw,2rem); background:var(--panel); border:1px solid var(--line); border-radius:1rem; box-shadow:0 8px 30px rgb(16 24 40 / .05); }
    .lede { font-size:1.08rem; }
    .status { display:inline-flex; align-items:center; gap:.3rem; width:max-content; margin-right:.55rem; padding:.12rem .55rem; border:1px solid currentColor; border-radius:999px; font-size:.8rem; font-weight:800; }
    .status--pass { color:var(--pass); } .status--fail { color:var(--fail); } .status--warn { color:var(--warn); } .status--neutral { color:var(--info); }
    .facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); gap:.7rem; margin:1rem 0; }
    .facts div { padding:.7rem .8rem; background:var(--bg); border-radius:.6rem; }
    .facts dt { color:var(--muted); font-size:.78rem; font-weight:800; }
    .facts dd { margin:.16rem 0 0; white-space:pre-wrap; }
    .table-wrap { max-width:100%; overflow:auto; border:1px solid var(--line); border-radius:.7rem; }
    table { width:100%; border-collapse:collapse; min-width:44rem; }
    .wide-table { min-width:76rem; }
    .support-table { min-width:62rem; }
    th,td { padding:.7rem .8rem; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
    thead th { background:var(--bg); }
    tbody tr:last-child th,tbody tr:last-child td { border-bottom:0; }
    .stage-list { display:grid; gap:1rem; }
    .stage { padding:1rem; border:1px solid var(--line); border-radius:.8rem; }
    .stage > header { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
    summary { cursor:pointer; font-weight:800; }
    details { margin-top:.7rem; }
    pre { max-width:100%; overflow:auto; padding:1rem; border-radius:.65rem; background:var(--code); color:#f7f8fa; white-space:pre-wrap; word-break:break-word; }
    .check-list,.persona-grid { padding:0; list-style:none; }
    .check-list { display:grid; gap:.6rem; }
    .check-list > li { padding:.8rem; border:1px solid var(--line); border-radius:.65rem; }
    .check-list p { margin:.35rem 0 0; color:var(--muted); }
    .persona-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(15rem,1fr)); gap:.8rem; }
    .persona-grid > li { padding:1rem; border:1px solid var(--line); border-radius:.75rem; }
    .persona-grid p { margin:.45rem 0; }
    .reader-mode { padding:.8rem 1rem; border-left:4px solid var(--info); background:var(--bg); }
    .reader-summary { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.8rem; padding:1rem; margin-bottom:1rem; background:var(--bg); border-radius:.7rem; }
    .reader-summary p { margin:0; }
    .critical { margin-top:1rem; padding:1rem; border-left:5px solid var(--fail); background:color-mix(in srgb,var(--fail) 8%,var(--panel)); }
    .evidence-list li + li { margin-top:.75rem; }
    .evidence-list p { margin:.15rem 0; color:var(--muted); }
    .muted { color:var(--muted); }
    footer { padding:1.5rem 0 3rem; color:var(--muted); text-align:center; }
    @media (max-width:650px) { .shell { width:min(100% - 1rem,1100px); } .hero { padding:2.5rem 0 1.5rem; } section { border-radius:.7rem; } .stage > header { display:block; } .status { margin-top:.35rem; } }
    @media (prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } }
    @media print { nav,.skip-link { display:none; } body { background:#fff; color:#000; } section { break-inside:avoid; box-shadow:none; } }
    @media (prefers-color-scheme:dark) { :root { --bg:#101318; --panel:#181d24; --text:#edf1f6; --muted:#aab4c0; --line:#343c47; --accent:#8facff; --pass:#55d69e; --fail:#ff8a80; --warn:#ffd166; --info:#b8c2cc; --code:#080b0f; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <header class="hero">
    <div class="shell">
      <p class="eyebrow">Decant · 실행 보고서</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="hero-summary"><strong>핵심 요약:</strong> ${escapeHtml(heroSummary)}</div>
      <div class="meta">${statusBadge(overallStatus)}<span>실행 ID ${escapeHtml(runId)}</span><time datetime="${escapeHtml(generatedAt)}">생성 ${escapeHtml(generatedAt)}</time></div>
    </div>
  </header>
  <nav aria-label="보고서 목차"><div class="shell"><ul>
    <li><a href="#overview">요약</a></li><li><a href="#routing">라우팅</a></li>${hasGlobalRepos ? '<li><a href="#global">글로벌 증류</a></li>' : ''}${hasSkillPack ? '<li><a href="#skills">Skill pack</a></li>' : ''}${hasComparisons ? '<li><a href="#comparison">국내·계보</a></li>' : ''}${hasSupportMatrix ? '<li><a href="#support">지원 범위</a></li>' : ''}${hasGrowthPlan ? '<li><a href="#growth">발전·홍보</a></li>' : ''}<li><a href="#stages">단계 출력</a></li><li><a href="#verification">검증</a></li><li><a href="#reader10">Reader-10</a></li><li><a href="#evidence">근거</a></li><li><a href="#actions">다음 단계</a></li>
  </ul></div></nav>
  <main id="main" class="shell">
    <section id="overview" aria-labelledby="overview-title"><p class="eyebrow">01 · 한눈에 보기</p><h2 id="overview-title">목적과 결과 요약</h2><p class="muted"><strong>용어:</strong> CLI(명령줄 인터페이스), HTML(웹 문서 형식), ID(식별자), PASS(통과), FAIL(실패).</p><h3>요청 목적</h3>${renderText(task, 'lede')}<h3>최종 결과</h3>${renderText(summary, 'lede')}${renderKeyValue({ 실행상태: STATUS_LABELS[normalizeStatus(overallStatus)], 실행ID: runId, 생성시각: generatedAt })}</section>
    <section id="routing" aria-labelledby="routing-title"><p class="eyebrow">02 · 의사결정</p><h2 id="routing-title">모델 라우팅</h2><p>실행 전에 정한 프로필과 실제 실행 여부입니다. 프로필은 카탈로그 메타데이터 기반 역할이며 가격이나 성능 순위를 보장하지 않습니다.</p>${renderRouting(data.routing)}</section>
    ${hasGlobalRepos ? `<section id="global" aria-labelledby="global-title"><p class="eyebrow">글로벌 · 2026-07-14 스냅샷</p><h2 id="global-title">글로벌 상위 저장소에서 무엇을 증류했나</h2>${renderText(data.globalSummary ?? '별 수는 인기와 발견 신호일 뿐 품질, 사용량, 성능을 증명하지 않습니다. 현재성, 구조, 테스트, 라이선스를 함께 봤습니다.')} ${renderGlobalRepos(globalRepos)}</section>` : ''}
    ${hasSkillPack ? `<section id="skills" aria-labelledby="skills-title"><p class="eyebrow">Skill · progressive disclosure</p><h2 id="skills-title">여덟 개만 남긴 Decant Skill pack</h2>${renderText(data.skillSummary ?? 'Skill은 한 가지 일을 맡고 필요할 때만 로드됩니다. Plugin은 이 Skill들을 배포하는 묶음이며 현재 task 모델을 바꾸지 않습니다. 스킬 id는 당분간 decant-* 레거시 이름을 유지합니다.')} ${renderSkillPack(skillPack)}</section>` : ''}
    ${hasComparisons ? `<section id="comparison" aria-labelledby="comparison-title"><p class="eyebrow">비교 · 설계 계보</p><h2 id="comparison-title">하네스별 장단점과 Decant 체리피킹</h2>${renderText(data.comparisonSummary ?? 'Decant(구 Relay10)은 비교 대상의 코드를 복사하지 않고, 검증 가능한 동작 패턴만 선택적으로 독립 구현했습니다.')} ${renderHarnessComparison(comparisons)}</section>` : ''}
    ${hasSupportMatrix ? `<section id="support" aria-labelledby="support-title"><p class="eyebrow">지원 · 이식성</p><h2 id="support-title">현재 공급자·CLI·앱 지원 범위</h2>${renderText(data.supportSummary ?? '현재 작동하는 범위와 향후 구현 가능한 범위를 구분합니다.')} ${renderSupportMatrix(supportMatrix)}</section>` : ''}
    ${hasGrowthPlan ? `<section id="growth" aria-labelledby="growth-title"><p class="eyebrow">발전 · 증거 중심 홍보</p><h2 id="growth-title">앞으로 30일·60일·90일에 할 일</h2>${renderText(data.growthSummary ?? '기능 수보다 재현 가능한 성공 사례, 실패 공개, 사용자 유지율을 우선합니다.')} ${renderGrowthPlan(growthPlan)}</section>` : ''}
    <section id="stages" aria-labelledby="stages-title"><p class="eyebrow">03 · 작업 기록</p><h2 id="stages-title">단계별 출력</h2>${renderStages(data)}</section>
    <section id="verification" aria-labelledby="verification-title"><p class="eyebrow">04 · 품질 확인</p><h2 id="verification-title">검증 결과</h2><p>실패나 오류가 있으면 아래 세부 기록과 다음 단계에서 복구 방법을 확인하세요.</p>${renderVerification(data.verification)}</section>
    <section id="reader10" aria-labelledby="reader10-title"><p class="eyebrow">05 · 보고서 검수</p><h2 id="reader10-title">Reader-10 검수</h2><p>선택된 모드의 구조 규칙 또는 모델 응답을 집계한 결과이며, 사실성 검증을 대신하지 않습니다.</p>${renderReader10(reader)}</section>
    <section id="evidence" aria-labelledby="evidence-title"><p class="eyebrow">06 · 추적 가능성</p><h2 id="evidence-title">근거와 출처</h2>${renderEvidence(evidence)}</section>
    <section id="actions" aria-labelledby="actions-title"><p class="eyebrow">07 · 실행 안내</p><h2 id="actions-title">다음 단계</h2><p>필요한 조치를 순서대로 실행하고, 문제가 생기면 검증 결과의 오류 또는 대안 기록을 먼저 확인하세요.</p>${renderNextSteps(nextSteps)}</section>
  </main>
  <footer class="shell"><p>이 파일은 외부 스크립트나 스타일시트 없이 생성된 자체 포함 Decant 보고서입니다.</p></footer>
</body>
</html>`;
}

export const renderReport = generateReport;
