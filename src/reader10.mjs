const DEFAULT_JARGON = Object.freeze([
  '오케스트레이션',
  '하네스',
  '라우팅',
  '프로비저닝',
  '벡터',
  '임베딩',
  '스키마',
  '파이프라인',
  '레이트리밋',
  '프롬프트',
]);

const VAGUE_REFERENCES = /(?:이것|그것|저것|해당 것|위와 같이|아래와 같이|적절히|알아서|필요시|등을 처리|\bthis one\b|\bthat one\b|\bas above\b|\bas below\b|\bappropriately\b|\bas needed\b|\bhandle the rest\b)/gi;

/**
 * Cues the structural checks look for, in Korean and English.
 *
 * These used to be Korean-only, which quietly made the gate a Korean-language
 * gate: an English report failed `hasSummary`, `hasPurpose`, and the rest no
 * matter how well written it was. The checks are about whether a document says
 * what it is for and what to do next, and that is not a property of one
 * language, so both vocabularies are accepted.
 */
const CUES = Object.freeze({
  summary: /요약|한눈에|핵심|결론|최종 결과|결과 요약|\bsummary\b|\bconclusion\b|\bat a glance\b|\btl;?dr\b|\bkey (?:results?|findings?|points?)\b|\boutcome\b/i,
  purpose: /목적|요청|목표|위해|하려면|해야|이 문서|이 보고서|\bpurpose\b|\bgoal\b|\bobjective\b|\brequest(?:ed)?\b|\bin order to\b|\bthis (?:document|report)\b/i,
  action: /다음|단계|실행|사용|해야|하세요|명령|조치|권장|확인|\bnext steps?\b|\brun\b|\busage?\b|\bcommand\b|\brecommend(?:ed|ation)?\b|\byou should\b|\bverify\b/i,
  prerequisite: /전제|준비|필요|요구|먼저|조건|환경|\bprerequisites?\b|\brequire[sd]?\b|\bbefore you\b|\bassumes?\b|\benvironment\b|\bsetup\b/i,
  failure: /실패|오류|예외|문제|주의|경고|대안|복구|\bfail(?:ed|ure|s)?\b|\berror\b|\bexception\b|\bwarning\b|\bcaution\b|\bfallback\b|\brecover(?:y)?\b|\brollback\b/i,
  evidence: /근거|출처|검증|증거|인용|참고|https?:\/\/|\bevidence\b|\bsource\b|\bverified\b|\bcitation\b|\bsee also\b|\breference\b/i,
});
const BLOCK_END = /<\/(?:address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tr|ul)>/gi;

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function inputToString(input) {
  if (typeof input === 'string') return input;
  if (input == null) return '';
  if (typeof input === 'object') {
    for (const key of ['html', 'text', 'content', 'body']) {
      if (typeof input[key] === 'string') return input[key];
    }
  }
  return String(input);
}

/** Convert HTML or plain text to a stable, human-readable text representation. */
export function extractReadableText(input) {
  const source = inputToString(input);
  const withoutHiddenContent = source
    .replace(/<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(BLOCK_END, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutHiddenContent)
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractHeadingLevels(source) {
  const levels = [];
  for (const match of source.matchAll(/<h([1-6])\b[^>]*>/gi)) levels.push(Number(match[1]));
  for (const match of source.matchAll(/^\s{0,3}(#{1,6})\s+/gm)) levels.push(match[1].length);
  return levels;
}

function hasHeadingJump(levels) {
  return levels.some((level, index) => index > 0 && level - levels[index - 1] > 1);
}

function inspectLinks(source) {
  const links = [];
  for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/\bhref\s*=\s*(['"])(.*?)\1/i)?.[2] ?? '';
    const label = extractReadableText(match[2]);
    links.push({ href, label });
  }
  return links;
}

function inspectImages(source) {
  const images = [...source.matchAll(/<img\b([^>]*)>/gi)];
  return {
    count: images.length,
    missingAlt: images.filter((match) => !/\balt\s*=\s*(['"])[\s\S]*?\1/i.test(match[1])).length,
  };
}

function inspectTables(source) {
  const tables = [...source.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  return {
    count: tables.length,
    withoutHeaders: tables.filter((match) => !/<th\b/i.test(match[1])).length,
  };
}

function buildContext(input, options) {
  const source = inputToString(input);
  const text = extractReadableText(source);
  const isHtml = /<\/?[a-z][^>]*>/i.test(source);
  const words = text ? text.split(/\s+/u).filter(Boolean) : [];
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const sentences = text
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const headings = extractHeadingLevels(source);
  const links = inspectLinks(source);
  const images = inspectImages(source);
  const tables = inspectTables(source);
  const jargon = options.jargon ?? DEFAULT_JARGON;
  const jargonHits = jargon.filter((term) => text.includes(term));
  const acronyms = [...new Set(text.match(/\b[A-Z][A-Z0-9-]{1,}\b/g) ?? [])];
  const explainedAcronyms = acronyms.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:${escaped}\\s*[(:：]|${escaped}\\s*(?:은|는|이란|란))`).test(text)
      || new RegExp(`<abbr\\b[^>]*title=['"][^'"]+['"][^>]*>\\s*${escaped}\\s*</abbr>`, 'i').test(source);
  });
  const avgSentenceChars = sentences.length
    ? sentences.reduce((total, sentence) => total + sentence.length, 0) / sentences.length
    : text.length;
  const avgParagraphChars = paragraphs.length
    ? paragraphs.reduce((total, paragraph) => total + paragraph.length, 0) / paragraphs.length
    : text.length;
  const firstThird = text.slice(0, Math.max(120, Math.ceil(text.length * 0.34)));

  return {
    source,
    text,
    isHtml,
    words,
    paragraphs,
    sentences,
    headings,
    links,
    images,
    tables,
    jargonHits,
    acronyms,
    unexplainedAcronyms: acronyms.filter((term) => !explainedAcronyms.includes(term)),
    metrics: {
      wordCount: words.length,
      characterCount: text.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      headingCount: headings.length,
      listItemCount: countMatches(source, /<li\b|^\s*[-*+]\s+/gim),
      linkCount: links.length,
      avgSentenceChars: Number(avgSentenceChars.toFixed(1)),
      avgParagraphChars: Number(avgParagraphChars.toFixed(1)),
      jargonCount: jargonHits.length,
      unexplainedAcronymCount: acronyms.length - explainedAcronyms.length,
      vagueReferenceCount: countMatches(text, VAGUE_REFERENCES),
      numericClaimCount: countMatches(text, /(?:^|\s)\d+(?:[.,]\d+)?(?:%|개|명|회|배|원|달러|초|분|시간|일|개월|년)?/g),
    },
    flags: {
      hasTitle: isHtml ? /<title\b[^>]*>[^<\s][\s\S]*?<\/title>|<h1\b[^>]*>[^<\s][\s\S]*?<\/h1>/i.test(source) : /^\s*(?:#\s+)?\S.{2,}$/m.test(source),
      hasH1: !isHtml || /<h1\b[^>]*>[^<\s][\s\S]*?<\/h1>/i.test(source),
      hasMain: !isHtml || /<main\b/i.test(source),
      // Any declared language passes. This used to require lang="ko", which meant
      // an English report could not clear the project's own clarity gate — a bug,
      // not a policy.
      hasLangDeclaration: !isHtml || /<html\b[^>]*\blang\s*=\s*(['"])[a-z]{2}(?:-[A-Za-z0-9]+)*\1/i.test(source),
      hasViewport: !isHtml || /<meta\b[^>]*\bname\s*=\s*(['"])viewport\1/i.test(source),
      hasSummary: CUES.summary.test(text),
      hasEarlySummary: CUES.summary.test(firstThird),
      hasPurpose: CUES.purpose.test(text),
      hasAction: CUES.action.test(text),
      hasPrerequisite: CUES.prerequisite.test(text),
      hasFailureGuidance: CUES.failure.test(text),
      hasEvidence: CUES.evidence.test(text),
      hasHeadingJump: hasHeadingJump(headings),
      hasWideFixedLayout: /(?:width|min-width)\s*:\s*(?:1[3-9]\d{2}|[2-9]\d{3,})px/i.test(source),
    },
  };
}

function check(id, label, passed, detail, severity = 'warning') {
  return { id, label, passed: Boolean(passed), severity, detail };
}

function definePersona(id, name, description, evaluate) {
  return Object.freeze({ id, name, description, evaluate });
}

/** The ten deterministic reader viewpoints used by the comprehension gate. */
export const READER10_PERSONAS = Object.freeze([
  definePersona('executive', '30초 독자', '제목, 목적, 핵심 결과만 훑어보는 독자', (ctx) => [
    check('title', '제목이 있다', ctx.flags.hasTitle, '문서의 목적지를 바로 알 수 있는 제목이 필요합니다.'),
    check('purpose', '목적이 드러난다', ctx.flags.hasPurpose, '첫 부분에 목적이나 목표를 명시하세요.'),
    check('summary', '요약 또는 결론이 있다', ctx.flags.hasSummary, '짧은 핵심 요약이나 결론을 추가하세요.'),
  ]),
  definePersona('beginner', '도메인 초보자', '전문용어 배경지식이 없는 독자', (ctx) => [
    check('jargon', '전문용어가 과도하지 않다', ctx.jargonHits.length <= Math.max(2, Math.ceil(ctx.words.length / 100)), `감지된 전문용어: ${ctx.jargonHits.join(', ') || '없음'}`),
    check('acronym', '약어가 설명된다', ctx.unexplainedAcronyms.length <= 1, `설명되지 않은 약어: ${ctx.unexplainedAcronyms.join(', ') || '없음'}`),
  ]),
  definePersona('plain-language', '쉬운 문장 독자', '짧고 직접적인 문장을 선호하는 독자', (ctx) => [
    check('sentence-length', '문장이 지나치게 길지 않다', ctx.metrics.avgSentenceChars <= 120, `평균 문장 길이: ${ctx.metrics.avgSentenceChars}자`),
    check('paragraph-length', '문단이 지나치게 길지 않다', ctx.metrics.avgParagraphChars <= 700, `평균 문단 길이: ${ctx.metrics.avgParagraphChars}자`),
  ]),
  definePersona('non-native', '비원어민 독자', '명시적 구조와 용어 설명이 필요한 독자', (ctx) => [
    check('headings', '긴 문서에 구조 표지가 있다', ctx.metrics.characterCount < 500 || ctx.metrics.headingCount >= 2, `제목 수: ${ctx.metrics.headingCount}`),
    check('acronym', '약어 장벽이 낮다', ctx.unexplainedAcronyms.length <= 1, `설명되지 않은 약어: ${ctx.unexplainedAcronyms.join(', ') || '없음'}`),
  ]),
  definePersona('literal', '문자 그대로 읽는 독자', '모호한 지시어를 추측하지 않는 독자', (ctx) => [
    check('vague-reference', '모호한 지시어가 적다', ctx.metrics.vagueReferenceCount <= 1, `모호한 표현 수: ${ctx.metrics.vagueReferenceCount}`),
    check('explicit-action', '행동이 명시되어 있다', ctx.flags.hasAction || ctx.metrics.characterCount < 180, '다음 행동이나 확인 방법을 명시하세요.'),
  ]),
  definePersona('mobile', '모바일 독자', '좁은 화면에서 제목과 목록을 훑는 독자', (ctx) => [
    check('viewport', '모바일 viewport를 선언한다', ctx.flags.hasViewport, 'HTML에 viewport 메타 태그를 추가하세요.'),
    check('fixed-width', '고정 대형 폭을 강제하지 않는다', !ctx.flags.hasWideFixedLayout, '1300px 이상의 고정 폭을 제거하세요.'),
  ]),
  definePersona('screen-reader', '스크린리더 독자', '문서 의미 구조와 대체 텍스트에 의존하는 독자', (ctx) => [
    check('lang', '문서 언어를 선언한다', ctx.flags.hasLangDeclaration, 'HTML 루트에 lang 속성을 추가하세요. 예: lang="en" 또는 lang="ko".'),
    check('landmark', 'main 랜드마크와 h1이 있다', ctx.flags.hasMain && ctx.flags.hasH1, 'main 요소와 하나의 h1을 제공하세요.'),
    check('alt', '모든 이미지에 alt가 있다', ctx.images.missingAlt === 0, `alt 없는 이미지 수: ${ctx.images.missingAlt}`, 'critical'),
    check('table-header', '표에 머리글이 있다', ctx.tables.withoutHeaders === 0, `머리글 없는 표 수: ${ctx.tables.withoutHeaders}`),
    check('heading-order', '제목 단계가 건너뛰지 않는다', !ctx.flags.hasHeadingJump, 'h2 다음에 바로 h4처럼 단계를 건너뛰지 마세요.'),
  ]),
  definePersona('skeptic', '근거 확인 독자', '수치와 결론의 검증 근거를 찾는 독자', (ctx) => [
    check('evidence', '수치가 있으면 근거도 있다', ctx.metrics.numericClaimCount === 0 || ctx.flags.hasEvidence, `수치 표현 수: ${ctx.metrics.numericClaimCount}`),
    check('link-label', '링크 이름이 의미 있다', ctx.links.every((link) => link.label && !/^(?:여기|클릭|링크|more|click here)$/i.test(link.label)), '링크 목적을 링크 텍스트 자체에 적으세요.'),
  ]),
  definePersona('operator', '실행 담당자', '보고서를 읽고 바로 행동해야 하는 독자', (ctx) => [
    check('action', '다음 행동이 있다', ctx.flags.hasAction, '담당자가 실행할 다음 행동을 명시하세요.'),
    check('prerequisite', '전제조건이 있다', ctx.flags.hasPrerequisite || ctx.metrics.characterCount < 300, '환경이나 준비 조건을 명시하세요.'),
    check('failure', '실패 시 안내가 있다', ctx.flags.hasFailureGuidance || ctx.metrics.characterCount < 300, '오류나 실패 시 대안을 명시하세요.'),
  ]),
  definePersona('conclusion-first', '결론 우선 독자', '본문보다 요약과 최종 상태를 먼저 읽는 독자', (ctx) => [
    check('early-summary', '요약이 문서 앞부분에 있다', ctx.flags.hasEarlySummary, '핵심 요약을 문서 첫 1/3 안으로 이동하세요.'),
    check('structure', '제목 구조가 있다', ctx.metrics.characterCount < 350 || ctx.metrics.headingCount >= 2, `제목 수: ${ctx.metrics.headingCount}`),
  ]),
]);

/** Aggregate pre-computed persona results using the Reader-10 gate. */
export function aggregateReader10(personaResults, options = {}) {
  const results = Array.isArray(personaResults) ? personaResults : [];
  const minPass = Number.isFinite(options.minPass)
    ? Math.max(1, Math.min(results.length || 10, Math.trunc(options.minPass)))
    : 9;
  const externalCritical = Array.isArray(options.criticalIssues) ? options.criticalIssues : [];
  const checkCritical = results.flatMap((persona) =>
    (persona.checks ?? [])
      .filter((item) => !item.passed && item.severity === 'critical')
      .map((item) => ({ personaId: persona.id, checkId: item.id, message: item.detail })),
  );
  const criticalIssues = [...externalCritical, ...checkCritical];
  const passedPersonas = results.filter((persona) => persona.passed).length;
  const failedPersonas = results.length - passedPersonas;
  const passed = results.length > 0 && passedPersonas >= minPass && criticalIssues.length === 0;

  return {
    passed,
    pass: passed,
    status: passed ? 'pass' : 'fail',
    minPass,
    totalPersonas: results.length,
    passedPersonas,
    failedPersonas,
    criticalCount: criticalIssues.length,
    criticalIssues,
  };
}

/** Run all ten deterministic comprehension readers against HTML or plain text. */
export function evaluateReader10(input, options = {}) {
  const context = buildContext(input, options);
  const criticalIssues = [];

  if (context.metrics.characterCount < 10) {
    criticalIssues.push({ code: 'empty-content', message: '검수할 수 있는 본문이 없습니다.' });
  }
  if (/<(?:iframe|object|embed)\b/i.test(context.source)) {
    criticalIssues.push({ code: 'active-embed', message: '자체 포함 보고서에 활성 외부 임베드가 있습니다.' });
  }
  if (context.links.some((link) => /^\s*(?:javascript|vbscript|data):/i.test(link.href))) {
    criticalIssues.push({ code: 'unsafe-link', message: '실행 가능한 위험한 링크가 있습니다.' });
  }

  const personas = READER10_PERSONAS.map((persona) => {
    const checks = persona.evaluate(context);
    return {
      id: persona.id,
      name: persona.name,
      description: persona.description,
      passed: checks.every((item) => item.passed),
      checks,
      recommendations: checks.filter((item) => !item.passed).map((item) => item.detail),
    };
  });
  const aggregate = aggregateReader10(personas, {
    minPass: options.minPass ?? 9,
    criticalIssues,
  });

  return {
    version: 1,
    mode: 'deterministic',
    ...aggregate,
    metrics: context.metrics,
    personas,
  };
}

const ALIGNMENT_STOPWORDS = new Set([
  '그리고', '작업', '요청', '구현', '만들어', '해줘', '해주세요', '위해', '결과', '보고서',
  'the', 'and', 'for', 'with', 'this', 'that', 'task', 'build', 'make', 'please',
]);

function meaningfulTokens(value) {
  return [...new Set(String(value ?? '').toLowerCase().match(/[가-힣]{2,}|[a-z0-9][a-z0-9.-]{2,}/giu) ?? [])]
    .filter((token) => !ALIGNMENT_STOPWORDS.has(token));
}

function payloadLines(value) {
  const stringify = (item) => JSON.stringify(item, (key, child) => (
    ['url', 'href', 'source'].includes(key) ? undefined : child
  ));
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : stringify(item));
  if (value && typeof value === 'object') return [stringify(value)];
  return value == null || value === '' ? [] : [String(value)];
}

/**
 * Audit canonical report content without template or navigation boilerplate.
 * This is a conservative structural/alignment check, not proof of semantic truth.
 */
export function evaluateReader10Payload(payload = {}, options = {}) {
  const task = String(payload.task ?? '').trim();
  const summary = String(payload.summary ?? '').trim();
  const evidence = payloadLines(payload.evidence);
  const verification = payloadLines(payload.verification);
  const risks = payloadLines(payload.risks);
  const nextSteps = payloadLines(payload.nextSteps);
  const canonical = [
    '# 목적', task,
    '# 결과 요약', summary,
    '# 근거와 검증', ...evidence, ...verification,
    '# 위험과 실패 시 안내', ...risks,
    '# 다음 단계와 실행 조치', ...nextSteps,
  ].join('\n\n');
  const base = evaluateReader10(canonical, { ...options, minPass: options.minPass ?? 9 });
  const criticalIssues = [...base.criticalIssues];
  const taskTokens = meaningfulTokens(task);
  const summaryTokens = new Set(meaningfulTokens(summary));
  const aligned = taskTokens.length === 0 || taskTokens.some((token) => summaryTokens.has(token));
  const evidenceRequired = /조사|검색|크롤|근거|출처|current|latest|research|search|crawl/i.test(task)
    || /(?:^|\s)\d+(?:[.,]\d+)?(?:%|개|명|회|배|원|달러|초|분|시간|일|개월|년)?/u.test(summary);

  if (task.length < 3) criticalIssues.push({ code: 'missing-task', message: '검수할 목적이 비어 있거나 너무 짧습니다.' });
  if (summary.length < 20) criticalIssues.push({ code: 'missing-summary', message: '결과 요약이 비어 있거나 너무 짧습니다.' });
  if (!aligned) criticalIssues.push({ code: 'task-summary-misalignment', message: '요청과 결과 요약 사이에 확인 가능한 핵심어 연결이 없습니다.' });
  if (evidenceRequired && evidence.length + verification.length === 0) {
    criticalIssues.push({ code: 'missing-evidence', message: '조사 또는 수치 주장에 연결된 근거·검증 기록이 없습니다.' });
  }
  if (nextSteps.length === 0) criticalIssues.push({ code: 'missing-next-step', message: '독자가 실행할 다음 단계가 없습니다.' });
  if (risks.length === 0) criticalIssues.push({ code: 'missing-risk', message: '남은 위험 또는 실패 시 행동이 없습니다.' });

  const aggregate = aggregateReader10(base.personas, {
    minPass: options.minPass ?? 9,
    criticalIssues,
  });
  return {
    ...base,
    ...aggregate,
    mode: 'deterministic-structure',
    semanticVerified: false,
    alignment: {
      passed: aligned,
      taskTokens,
      sharedTokens: taskTokens.filter((token) => summaryTokens.has(token)),
    },
    canonical,
  };
}

export const runReader10 = evaluateReader10;
