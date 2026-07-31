import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { evaluateReader10, evaluateReader10Payload } from '../src/reader10.mjs';
import { generateReport } from '../src/report.mjs';
import { describeTarget, evidenceTarget, writeEvidence } from './frozen-evidence.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const outputs = path.join(root, 'outputs');
// Resolve frozen-evidence targets up front so an unsatisfied --freeze guard
// fails before the report is rendered.
const reportDestination = evidenceTarget(root, 'docs/launch-report.html');
const deterministicDestination = evidenceTarget(root, 'docs/launch-reader-deterministic.json');
await mkdir(outputs, { recursive: true });

// Deliberately the pre-rename URL: this script must keep reproducing the exact
// bytes of the released v0.1.1 docs/launch-report.html, whose recorded
// reportSha256 binding would break if any embedded string changed. GitHub
// redirects the old path to minwoo19930301/rein.
const repository = 'https://github.com/minwoo19930301/relay10';
const releaseTarget = `${repository}/releases/tag/v0.1.1`;
const verificationLog = JSON.parse(await readFile(path.join(root, 'docs', 'launch-verification.json'), 'utf8'));
if (verificationLog.passed !== true || !Array.isArray(verificationLog.commands)) {
  throw new Error('Run npm run verify:launch successfully before building the launch report.');
}
const testCommand = verificationLog.commands.find((command) => command.command === 'npm' && command.args?.[0] === 'test');
const testCount = Number(/ℹ tests (\d+)/.exec(testCommand?.stdout ?? '')?.[1] ?? 0);
const task = '국내 여섯 하네스와 GitHub의 글로벌 코딩 agent·workflow·Skill 저장소에 더해 Ouroboros를 공식 근거로 조사하고, 장단점과 Relay10의 채택·제외를 밝힌다. Ouroboros의 소크라틱 질문과 실행 전 의도 확인은 기존 relay10-spec 안의 가벼운 작업 계약으로 독립 구현하며, 공급자·CLI·앱 지원 경계와 30일·60일·90일 발전 계획을 하나의 검증된 HTML 보고서로 정리한다.';
const summary = `결론부터 말하면 Relay10 통합본은 글로벌 조사와 여덟 개의 clean-room Skill, Codex·Claude Code manifest, 조건부 frontier advisor, Grok Build Skill-host 근거를 한 core에 합쳤다. 모든 advisor 판단은 scout 이후 checkpoint에서 이뤄지며, economy 작업은 scout가 미결 질문을 남길 때만 frontier/max advisor를 부르고 비-economy 작업은 scout 이후 항상 advisor를 호출한다. always·never 정책으로 되돌릴 수 있다. 이는 호출 한 번을 생략할 수 있는 구조일 뿐 실제 비용·품질 우월성은 아직 forward evaluation 전이다. 상위 저장소에서는 OpenCode의 plan/build 권한 분리, Gemini CLI·Cline의 write 전 checkpoint, Aider의 architect/editor 분리, mini software-engineering agent의 작은 stateless core, Goose의 recipe success gate, Agent Orchestrator의 worker/reviewer adapter, Agent Skills의 progressive disclosure만 골랐다. daemon·DB·GUI·swarm·vector memory·scheduler·tmux를 core에 넣지 않았다. 고정 release v0.1.1의 공식 실행 경로는 여전히 Codex CLI와 현재 로컬 OpenAI 모델뿐이다. main의 repo Skill은 Codex App·CLI·IDE와 Claude Code·Grok Build host에서 발견될 수 있지만 현재 task 모델을 단계별로 바꾸지 않으며, Plugin에는 MCP server나 custom UI가 없다. 병합된 PR #3은 Grok Build가 여덟 Skill을 발견하는 host 경로만 실측했으며 xAI/Grok stage executor는 여전히 미검증 후보다. Claude·Gemini 직접 API와 한 run의 공급자 혼합도 미지원이다. 별 수는 인기·발견 신호일 뿐 품질이나 실사용 점유율의 증거가 아니다. 검증 근거는 ${testCount || '전체'}개 자동 테스트, JavaScript 문법, Skill·Plugin 정적 검사, 실제 Codex 모델 탐색, 모델 배정 미리보기, npm package 검사다. 이 HTML은 생성 후 economy 역할 모델을 low 노력으로 열 번 호출하는 Reader-10을 다시 실행한다. 별도 JSON의 passedPersonas 10, criticalCount 0, reportSha256 일치가 최종 판독 조건이다. 제품 발전은 30일 안에 설치·첫 성공 측정과 대표 demo를 만들고, 60일 안에 provider/worker port와 forward eval을 증명하며, 90일 안에 검증된 adapter 또는 local MCP 중 사용자 수요가 큰 하나만 출시하는 순서다. 용어: OMO(Oh My OpenAgent), OMP(Oh My Pi), OMC(Oh My ClaudeCode), OMX(Oh My Codex), GJC(Gajae-Code), CLI(명령줄), GUI(그래픽 화면), TUI(터미널 화면), UI(사용자 화면), UX(사용 경험), IDE(개발 환경), DB(database·데이터베이스), JSON(구조화 데이터), SDK(개발 도구 모음), URL(웹 주소), HTTP(웹 통신 규격), MIT(허용 범위가 넓은 오픈소스 라이선스), LICENSE(라이선스 파일), NOTICE(출처·권리 고지), SKILL(SKILL.md 작업 지침 파일), Skill(필요할 때 불러오는 작업 지침), Plugin(Skill과 선택적 연결 요소의 배포 묶음), MCP(앱과 도구 연결 규격), API(프로그램 연결 규격), RPC(원격 기능 호출), ACP(agent communication protocol·에이전트 통신 규격), LSP(language server protocol·언어 서버 규격), DAP(debug adapter protocol·디버거 규격), AST(abstract syntax tree·코드 문법 트리), PRD(product requirements document·제품 요구 문서), QA(quality assurance·품질 검증), TDD(test-driven development·테스트 주도 개발), SUL(sustainable use license·지속가능 사용 라이선스), DSL(domain-specific language·도메인 전용 언어), HUD(head-up display·상태 표시 화면), RLM(긴 문맥 처리 연구 방식), ADR(architecture decision record·설계 결정 기록), CI(continuous integration·지속 통합), CDC(change data capture·변경 데이터 추적), PR(pull request·변경 제안), HN(Hacker News), D30(30일 재사용 지표), E2E(처음부터 끝까지 검증), Reader-10(열 가지 독자 역할 검수), clean-room(동작 아이디어만 보고 코드·문구를 새로 작성), progressive disclosure(필요한 정보만 단계적으로 로드), dry-run(변경 없는 미리보기), SHA-256(파일 내용 식별값).`;
const ouroborosSummary = `이 최종 통합본은 Ouroboros의 장점 중 저장소 사실을 먼저 확인하고 인간 결정만 제한적으로 질문한 뒤 실행 전 작업 계약을 확인하는 패턴만 기존 relay10-spec에 추가했다. 새 Skill·CLI·모델 호출·DB·MCP·TUI·Ralph·ontology loop는 넣지 않았다. Claude Code와 Grok Build의 Skill-host 표면은 PR #2/#3으로 main에 병합됐으며, 이 계약 변경까지 포함한 동일 fixture 행동 검증은 후속 과제로 남는다. xAI/Grok stage executor는 별도 종단간 검증 전까지 지원으로 표시하지 않는다. ${summary}`;

const evidence = [
  { title: 'Relay10 공개 저장소', url: repository, note: 'GitHub CLI로 게시한 공식 저장소다.' },
  { title: 'Relay10 v0.1.1 공개 릴리스', url: releaseTarget, note: '2026-07-13T05:15:21Z에 공개된 고정 배포본 주소다.' },
  { title: 'Reader-10 결과 저장 위치', url: `${repository}/blob/main/docs/launch-reader-live.json`, note: '이 HTML 생성 뒤 판독 명령이 10회 결과와 reportSha256으로 갱신한다. 링크의 결과는 reportSha256이 현재 HTML과 같을 때만 유효하다.' },
  { title: '출시 검증 원본 명령 로그', url: `${repository}/blob/main/docs/launch-verification.json`, note: `실행 시각 ${verificationLog.generatedAt}. 테스트·문법·모델 탐색·모델 배정·패키지 검사의 명령, 종료 코드, stdout, stderr 원문.` },
  { title: '자동 구조 검사 원본', url: `${repository}/blob/main/docs/launch-reader-deterministic.json`, note: '내용 구조와 최종 HTML 렌더를 각각 검사하고 치명적 문제 수를 기록한다.' },
  { title: '자동 테스트', url: `${repository}/tree/main/test`, note: `${testCount || '전체'}개 회귀 테스트: 모델 배정, 구성, 하위 프로세스, 파이프라인, 동결 재생, 보고서 안전성, Skill·Plugin 검증.` },
  { title: '한국 하네스 조사 원문', url: `${repository}/blob/main/docs/korea-landscape.md`, note: '사실·추론·명칭 혼선을 분리한 2026-07-13 스냅샷.' },
  { title: '글로벌 오픈소스 조사 원문', url: `${repository}/blob/main/docs/global-landscape.md`, note: '실사용 점유율이 아닌 공개 프로젝트 지형과 선행 패턴.' },
  { title: '글로벌 상위 저장소 증류표', url: `${repository}/blob/main/docs/global-top-repos.md`, note: '2026-07-14 GitHub API 스냅샷, 장단점, Relay10 채택·제외, archive·deprecated·라이선스 주의.' },
  { title: 'Clean-room prior art ledger', url: `${repository}/blob/main/docs/prior-art.md`, note: '어떤 동작 패턴을 참고했고 어떤 코드·문구·자산도 복사하지 않았는지 기록.' },
  { title: '30·60·90 발전·홍보 playbook', url: `${repository}/blob/main/docs/growth-playbook.md`, note: '개발 우선순위, 측정 지표, demo와 커뮤니티 홍보 원칙.' },
  { title: 'Relay10 Codex·Claude Code Skill pack', url: `${repository}/tree/main/plugins/relay10`, note: '여덟 Skill, Codex·Claude Code manifest, provenance, third-party pattern notice. MCP와 custom UI는 없음.' },
  { title: '조건부 advisor 설계·평가 계획', url: `${repository}/blob/main/docs/conditional-advisor-routing.md`, note: 'scout 이후 미결 질문에 따른 frontier advisor gate, always·never fallback, 아직 측정하지 않은 비용·품질 경계.' },
  { title: 'Relay10 설계 계보와 이식성 판정', url: `${repository}/blob/main/docs/lineage-and-portability.md`, note: '여섯 하네스의 장단점·채택·제외와 공급자·앱별 현재 지원 경계.' },
  { title: 'OpenAI 최신 모델 가이드', url: 'https://developers.openai.com/api/docs/guides/latest-model.md', note: '현재 모델 계열과 추론 노력 안내.' },
  { title: 'Codex 설정 참고', url: 'https://learn.chatgpt.com/docs/config-file/config-reference', note: '모델 노력도와 읽기·쓰기 격리 권한 설정.' },
  { title: 'Codex Skill 공식 문서', url: 'https://learn.chatgpt.com/docs/build-skills', note: 'Codex 앱·CLI·IDE에서 재사용 가능한 지침과 스크립트의 지원 표면.' },
  { title: 'Codex Plugin 공식 문서', url: 'https://learn.chatgpt.com/docs/build-plugins', note: 'Skill, MCP app, manifest를 묶는 앱 배포 경로.' },
  { title: '현재 OpenAI Plugin 예제', url: 'https://github.com/openai/plugins', note: 'deprecated openai/skills 대신 현재 참고한 공식 plugin 구조.' },
  { title: 'Agent Skills 표준', url: 'https://github.com/agentskills/agentskills', note: 'SKILL.md 폴더와 progressive disclosure의 이식 가능한 기준.' },
  { title: 'Superpowers', url: 'https://github.com/obra/superpowers', note: 'spec, systematic debugging, verification-before-completion 패턴. 문구와 코드는 복사하지 않음.' },
  { title: 'Ouroboros 공식 저장소', url: 'https://github.com/Q00/ouroboros/tree/456a1347195038ad0eea2bcfee21efee495d6cb9', note: '2026-07-15에 고정한 공식 커밋. interview→Seed→execute→evaluate→evolve 구조를 확인한 근거다.' },
  { title: 'Ouroboros 증류 결정', url: `${repository}/blob/main/docs/ouroboros-distillation.md`, note: '가져온 소크라틱 작업 계약과 가져오지 않은 Agent OS 기능을 구분한 clean-room 기록.' },
  { title: 'relay10-spec 초기 정성 검사', url: `${repository}/blob/main/docs/ouroboros-spec-forward-eval.md`, note: '분리된 with-Skill·no-Skill 응답과 held-out trigger 8건의 수동 관찰. 모델·노력도·token·시간·raw trace가 없어 warning이며 benchmark가 아니다.' },
  { title: 'Claude Code·Grok Build host 검증 PR #3', url: `${repository}/pull/3`, note: 'main에 병합된 여덟 Skill 발견 실측. Grok Build Skill host와 xAI/Grok stage executor를 명시적으로 구분한다.' },
  { title: 'Codex App Server 공식 문서', url: 'https://learn.chatgpt.com/docs/app-server', note: 'Codex 기반 custom client의 thread·turn·model API.' },
  { title: 'xAI Responses API', url: 'https://docs.x.ai/developers/quickstart', note: 'Grok의 Responses-compatible 실험 가능성을 판단한 공식 근거.' },
  { title: 'Anthropic OpenAI SDK compatibility', url: 'https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk', note: 'Claude 호환 계층과 현재 Codex Responses-only 경계의 차이.' },
  { title: 'Gemini OpenAI compatibility', url: 'https://ai.google.dev/gemini-api/docs/openai', note: 'Gemini 호환 계층과 네이티브 adapter 필요성을 판단한 공식 근거.' },
  { title: 'OMO · Oh My OpenAgent', url: 'https://github.com/code-yeongyu/oh-my-openagent' },
  { title: 'OMP · Oh My Pi', url: 'https://github.com/can1357/oh-my-pi' },
  { title: 'OMC · Oh My ClaudeCode', url: 'https://github.com/Yeachan-Heo/oh-my-claudecode' },
  { title: 'OMX · Oh My Codex', url: 'https://github.com/Yeachan-Heo/oh-my-codex' },
  { title: 'GJC · Gajae-Code', url: 'https://github.com/Yeachan-Heo/gajae-code' },
  { title: 'LazyCodex', url: 'https://github.com/code-yeongyu/lazycodex' },
  { title: 'OpenDev', url: 'https://github.com/opendev-to/opendev', note: '실행·사고·압축·자기검토 모델 슬롯을 나누는 직접 선행 사례.' },
  { title: 'Aider Architect와 Editor', url: 'https://aider.chat/2024/09/26/architect.html', note: '추론과 편집 모델을 분리한 선행 사례.' },
  { title: 'Continue 모델 역할', url: 'https://docs.continue.dev/customize/model-roles', note: '채팅·자동완성·편집·적용·임베딩·재순위화 역할 분리.' },
  { title: 'mini software-engineering agent', url: 'https://github.com/SWE-agent/mini-swe-agent', note: '작고 이해 가능한 코딩 에이전트 기준선.' },
];

const risks = [
  'economy·balanced·frontier는 Codex 카탈로그 메타데이터와 우선순위에 따른 역할 이름이지, 실시간 가격·지능·성공률 측정값이 아니다.',
  '실제 Reader-10은 같은 모델 계열을 여러 번 호출할 수 있으므로 10개의 독립적인 사람 판단으로 해석하면 안 된다.',
  '스카우트는 범용 Codex 읽기·검색 단계이며 전용 크롤러가 아니다. 복잡한 사이트 수집은 별도 도구가 필요하다.',
  '현재 코드는 codex executable, codex debug models, Codex 전용 sandbox·search·output-schema 인수에 결합돼 있다. OpenAI 호환 API라는 이유만으로 완전한 코딩 agent runtime 호환이 성립하지 않는다.',
  'main에 병합된 PR #3은 Grok Build가 Skill pack을 발견하는 host 경로만 검증했다. xAI/Grok stage executor는 실제 파일 도구·검색·structured output·Reader-10 종단간 검증이 없으므로 현재 지원으로 광고하면 안 된다.',
  'Codex Skill이나 Plugin은 앱에서 호출 경로를 만들 수 있지만 그 자체가 현재 앱 task의 모델을 Relay10 단계마다 교체하지는 않는다.',
  'main의 여덟 Skill과 Plugin manifest는 정적 구조 검증을 통과했지만 Codex App·CLI·IDE별 trigger recall과 no-skill baseline 비교는 아직 공개 benchmark가 아니다.',
  'Confirmed Task Contract는 relay10-spec이 따르는 Skill 수준의 작업 규율이다. 암호학적으로 고정된 Ouroboros Seed나 runtime 강제 장치로 해석하면 안 된다.',
  'Claude Code와 Grok Build host는 PR #2/#3으로 main에 병합됐지만 새 contract fixture를 실행하지 않았다. 공통 SKILL.md나 host discovery만으로 두 runtime의 동작 동등성을 주장하지 않는다.',
  '조건부 advisor는 economy 경로에서 호출 한 번을 생략할 수 있지만 token·시간·정확도·비용 개선을 아직 같은 task로 측정하지 않았다. 절감이나 성능 향상으로 광고하면 안 된다.',
  'Skill 저장소는 폴더별 라이선스가 다를 수 있다. Anthropic 문서 Skill, Vercel Skill, OpenAI Plugin은 파일 단위 검토 없이 문구·코드·자산을 복사하면 안 된다.',
  'GitHub 별은 인기·발견 신호이고 품질·보안·실사용자 수·비용 절감·생산성 향상을 증명하지 않는다. Continue와 Roo Code처럼 별이 많아도 유지 상태가 바뀔 수 있다.',
  '비교 프로젝트의 별, 릴리스, 기능, 라이선스 표시는 빠르게 바뀐다. 특히 OMO 코어의 Sustainable Use License는 상업 재사용 전 다시 확인해야 한다.',
  'Relay10 0.1에는 실행 중 자동 모델 승격, 재개 지점, 장기 예약 실행, 자체 목표 명령이 없다.',
];

const globalRepos = [
  { name: 'OpenCode', url: 'https://github.com/anomalyco/opencode', signal: '185,365★ · MIT · active', strengths: '다중 provider와 plan/build 권한 분리가 명료하다.', cautions: 'TUI·desktop·server·인증까지 가진 전체 runtime이다.', adopted: 'read-only plan과 단계별 permission 경계.', excluded: '두 번째 runtime·TUI·provider 인증층.' },
  { name: 'Claude Code', url: 'https://github.com/anthropics/claude-code', signal: '137,686★ · Commercial terms · active', strengths: 'CLI·IDE·GitHub·Plugin·Skill 경험이 한 runtime에서 이어진다.', cautions: '오픈소스가 아니며 vendor runtime과 prompt에 결합된다.', adopted: 'Plugin anatomy와 전문 reviewer 개념.', excluded: '코드·prompt 복사, 무한 loop, Claude 전용 가정.' },
  { name: 'Spec Kit', url: 'https://github.com/github/spec-kit', signal: '120,376★ · MIT · active', strengths: '원칙→spec→plan→task→구현을 실행 가능한 산출물로 잇는다.', cautions: '작은 되돌릴 수 있는 변경에는 의식이 너무 크다.', adopted: 'outcome·non-goal·acceptance·rollback.', excluded: '모든 작업의 constitution과 큰 artifact tree.' },
  { name: 'Ouroboros', url: 'https://github.com/Q00/ouroboros/tree/456a1347195038ad0eea2bcfee21efee495d6cb9', signal: '공식 커밋 456a134 · MIT · 2026-07-15 확인', strengths: '소크라틱 인터뷰로 모호한 의도를 Seed에 고정하고 실행·평가·진화로 잇는다.', cautions: 'DB·MCP·TUI·runtime adapter·Ralph loop를 포함한 전체 Agent OS라 작은 하네스에는 운영 표면이 크다.', adopted: '저장소 사실 선확인, 꼭 필요한 인간 결정만 최대 3개, 실행 전 Confirmed Task Contract, 의도 변경 시 새 revision.', excluded: 'Seed 스키마 복제, 수치 ambiguity score, ontology, Ralph loop, EventStore, resume, multi-runtime 지원 주장.' },
  { name: 'Gemini CLI', url: 'https://github.com/google-gemini/gemini-cli', signal: '105,958★ · Apache-2.0 · active', strengths: 'MCP·structured output·GitHub Action·checkpoint/restore가 있다.', cautions: 'Gemini 인증·도구·release channel을 포함한 독립 agent다.', adopted: 'write 전 checkpoint와 기계 판독 event 원칙.', excluded: 'Gemini runtime과 인증 stack.' },
  { name: 'OpenAI Codex', url: 'https://github.com/openai/codex', signal: '97,655★ · Apache-2.0 · active', strengths: 'sandbox·approval과 CLI·App·IDE 표면을 제공하는 검증된 host다.', cautions: 'Relay10이 현재 결합된 host이지 provider-neutral contract는 아니다.', adopted: '설치된 runtime·catalog·sandbox 재사용.', excluded: 'Codex 내부 구현이나 TUI 재구현.' },
  { name: 'OpenHands', url: 'https://github.com/OpenHands/OpenHands', signal: '80,656★ · core MIT/enterprise 별도 · active', strengths: 'backend·sandbox·SDK·local/remote surface를 분리한다.', cautions: 'server·canvas·automation·enterprise까지 운영 표면이 크다.', adopted: 'worker/provider port와 sandbox boundary 목표.', excluded: 'control plane·always-on server·enterprise stack.' },
  { name: 'Cline', url: 'https://github.com/cline/cline', signal: '64,613★ · Apache-2.0 · active', strengths: 'Plan/Act·checkpoint와 core를 여러 surface에 노출한다.', cautions: 'IDE·SDK·CLI 외 scheduler·team 기능까지 커졌다.', adopted: 'core/surface 분리와 checkpoint-before-write.', excluded: 'editor extension·Kanban·scheduler·messaging.' },
  { name: 'Ruflo', url: 'https://github.com/ruvnet/ruflo', signal: '64,278★ · MIT · active', strengths: '위험·비용·보안·관측을 plugin으로 모듈화한다.', cautions: '100+ agent·vector memory·swarm·학습 주장은 독립 검증이 필요하다.', adopted: '선택적 readiness와 risk budget 개념.', excluded: 'swarm·vector DB·self-learning·federation.' },
  { name: 'Goose', url: 'https://github.com/aaif-goose/goose', signal: '51,159★ · Apache-2.0 · active', strengths: 'portable recipe, JSON schema, retry, success gate, extension allowlist가 있다.', cautions: 'Desktop·CLI·API·70+ extension·memory DB를 품은 범용 agent다.', adopted: 'recipe success criteria와 capability gate 목표.', excluded: 'Desktop·memory DB·extension marketplace.' },
  { name: 'Aider', url: 'https://github.com/Aider-AI/aider', signal: '47,341★ · Apache-2.0 · push 2026-05', strengths: 'architect/editor/weak model 역할과 lint·test feedback을 분리한다.', cautions: '두 번의 model call과 git 중심 pair-programming 의견이 강하다.', adopted: '강한 설계·적당한 구현·싼 요약 역할.', excluded: 'interactive UI, 기본 auto-commit, repo map 재구현.' },
  { name: 'mini software-engineering agent', url: 'https://github.com/SWE-agent/mini-swe-agent', signal: '5,757★ · MIT · active', strengths: '작은 core, stateless subprocess, linear transcript가 이해 가능하다.', cautions: 'bash 하나에 안전성과 prompt 부담이 집중되고 UX가 작다.', adopted: '작고 읽히는 core와 append-only evidence.', excluded: 'custom tool zoo와 benchmark 우월성 주장.' },
  { name: 'Agent Orchestrator', url: 'https://github.com/AgentWrapper/agent-orchestrator', signal: '8,224★ · Apache-2.0 · active', strengths: 'agent·worker·runtime·workspace·SCM adapter와 reviewer adapter를 나눈다.', cautions: 'Electron·daemon·SQLite·PR watcher·telemetry가 필요하다.', adopted: 'worker adapter 경계와 독립 reviewer.', excluded: 'daemon·Electron·CDC·상시 polling.' },
];

const globalSummary = '2026-07-14 GitHub API와 각 공식 README를 다시 확인했고, Ouroboros는 2026-07-15 공식 커밋 456a134에 고정해 별도로 검토했다. 별 수는 인기·발견 신호일 뿐 품질·시장 점유율·생산성 증거가 아니다. Continue는 별이 많지만 README가 no longer actively maintained/read-only라고 밝혀 역사적 역할 분리 사례로만 남겼고, Roo Code는 archived 상태라 현행 추천에서 제외했다. Relay10은 동작 패턴만 독립 구현했으며, provider runtime·daemon·DB·GUI·swarm·vector memory·ontology loop는 core에 넣지 않았다.';

const skillPack = [
  { name: 'relay10-orchestrate', job: '요청을 가장 작은 안전 workflow로 보낸다.', patterns: 'OpenCode plan/build, thin orchestrator, Relay10 risk router', boundary: '현재 Codex task 모델을 바꾸거나 불필요한 stage를 만들지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-research', job: '현재 근거를 읽기 전용으로 수집한다.', patterns: 'Awesome Copilot evidence, selective grounding', boundary: '근거 수집은 수정 권한이 아니며 별을 품질로 해석하지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-spec', job: '저장소 사실을 먼저 확인하고 꼭 필요한 인간 결정을 물은 뒤 작업 계약을 확정한다.', patterns: 'Spec Kit, OpenSpec, Superpowers planning, Ouroboros Socratic interview', boundary: '명확한 작은 변경은 인터뷰를 생략하고, 질문은 한 번에 하나·기본 최대 3개다. 중대한 미결정은 build를 막는다.', status: 'warn', current: '구현·정적 회귀 검증 통과; 행동 검사는 계측 부족으로 warning' },
  { name: 'relay10-build', job: '승인된 변경을 작은 slice로 구현한다.', patterns: 'Superpowers TDD, vertical slice, bounded maker', boundary: '모든 artifact에 TDD를 강제하지 않고 publish하지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-debug', job: '재현→경계→가설→최소 실험으로 원인을 찾는다.', patterns: 'systematic debugging, stop-and-reassess', boundary: '진단 요청은 수정 권한이 아니며 세 번 같은 실패 뒤 재평가한다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-review', job: '고정 baseline의 spec·correctness·risk를 검토한다.', patterns: 'separate spec/quality review, reviewer adapter', boundary: 'read-only이며 maker의 self-review를 독립 증거로 부르지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-release', job: 'test·package·hash·support claim을 증명한다.', patterns: 'verification-before-completion, checkpoint, Reader-10 hash gate', boundary: '명시적 권한 없이 commit·push·tag·release하지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
  { name: 'relay10-skill-lab', job: 'trigger와 no-skill baseline으로 Skill 가치를 평가한다.', patterns: 'Agent Skills, Anthropic eval ideas, OpenAI plugin-eval', boundary: '라이선스 불명 문구를 복사하거나 효과 없는 Skill을 늘리지 않는다.', status: 'pass', current: 'main 구현·정적 검증' },
];

const skillSummary = 'Agent Skills 형식과 Codex Plugin 배포 구조를 따르되, 수백 개 catalog 대신 한 가지 일만 맡는 여덟 Skill만 둔다. Ouroboros 때문에 아홉 번째 Skill이나 새 runtime을 만들지 않고 기존 relay10-spec에 제한 질문과 Confirmed Task Contract만 보강했다. .agents/skills는 plugin의 canonical skills 폴더를 가리켜 Codex repo surface에서 중복 없이 발견된다. Plugin에는 MCP·hook·app UI가 없고 현재 task 모델을 교체하지 않는다. 모든 문구는 clean-room으로 새로 작성했으며 provenance와 license 주의를 함께 저장했다.';

const growthPlan = [
  { period: '0~30일 · 첫 성공 증명', product: '필수 fixture 4개와 실제 저장소 golden demo 1개를 만들고, stretch로 fixture 12개·demo 3개까지 늘린다.', proof: 'opt-in 관찰의 clone→첫 route 시간, routing set 12개, Skill당 positive/near-miss 각 3개를 공개한다.', promotion: '90초 무편집 terminal demo, 한국어·영어 README, 비교표보다 실제 before/after와 실패 로그를 GitHub Discussion·개발 커뮤니티에 공유한다.', metric: '필수 tester 5명 중 4명 5분 내 first dry-run, blocker issue 응답 48시간 이내.' },
  { period: '31~60일 · 반복 사용 증명', product: 'provider·worker·surface port ADR을 확정하고 Skill with/without forward eval, clean install CI, issue template을 운영한다.', proof: '품질·token·시간·실패 유형을 같은 task에서 비교하고 raw artifact와 재현 명령을 공개한다.', promotion: '주 1회 build log, 한 문제를 해결한 case study, maintainer 대상 피드백 요청. 별·속도 우월성 대신 측정 조건을 먼저 제시한다.', metric: '재사용자 3명 이상, 외부 issue 10건 중 70% 재현, 문서 PR 또는 외부 PR 1건.' },
  { period: '61~90일 · 하나의 확장만 출시', product: '수요가 더 큰 local MCP app surface 또는 검증 가능한 provider adapter 하나만 선택해 E2E gate 뒤 release 후보로 만든다.', proof: '지원 matrix의 tool·schema·search·workspace·Reader-10 전 항목과 rollback·security test를 통과시킨다.', promotion: 'versioned demo와 migration note, 솔직한 unsupported 목록, 동의·비밀 제거를 거친 case study 2개를 채널별로 맞춰 공개한다.', metric: '60일 이전 opt-in cohort의 D30 재사용 30% 이상, case study 2건, 허위 지원 claim 0건, 외부 contributor 2명.' },
];

const growthSummary = '홍보의 중심은 별 요청이나 “최고 모델 자동 배정” 문구가 아니라 재현 가능한 짧은 demo, raw 검증 artifact, 실패·미지원 공개다. 기능은 local MCP와 multi-provider를 동시에 벌이지 말고 60일의 사용자 증거로 하나만 고른다. stars·조회수는 보조 지표로만 보고 첫 성공률, 반복 사용, 외부 기여, 허위 통과 0건을 핵심 지표로 쓴다.';

const comparisons = [
  {
    name: 'OMO · Oh My OpenAgent',
    strengths: '전문 역할, 모델별 배정, 검색·편집·검증·Team·복구를 포함한 배터리 포함형 기능 폭이 크다.',
    weaknesses: 'Ultimate와 Codex Light의 차이가 크고 11 agent·54+ hook·MCP·장기 loop가 상태 소유권과 진단 표면을 늘린다. telemetry와 SUL 조건도 확인해야 한다.',
    adopted: 'scout→architect→maker→reviewer→explainer 역할 분리와 역할별 모델·노력도 명시.',
    excluded: 'OMO 코드, agent 군집, Team Mode, background agent, hook·MCP·LSP·AST 묶음, telemetry, 멈추지 않는 loop.',
  },
  {
    name: 'OMP · Oh My Pi',
    strengths: '40개 이상 provider, 역할별 모델, TUI·SDK·RPC·ACP, hash-anchored edit, LSP·DAP를 갖춘 완성형 독립 runtime이다.',
    weaknesses: 'TypeScript·Rust·native addon·browser·debugger까지 유지하는 큰 제품이라 인증·보안·회귀 비용이 높다.',
    adopted: '읽기는 낮은 비용, 계획은 강한 모델처럼 역할에 따라 모델 등급을 달리하고 실행을 별도 process 경계에 두는 원칙.',
    excluded: '다중 provider runtime, TUI·SDK·RPC·ACP, native 도구, LSP·DAP, credential rotation, hash-anchored editing. Relay10 artifact hash는 편집 기능이 아니다.',
  },
  {
    name: 'OMC · Oh My ClaudeCode',
    strengths: 'plan→PRD→exec→verify→fix 단계와 전문 역할, 실패를 수정으로 돌리는 QA loop가 명시적이다.',
    weaknesses: 'Claude host 안에 Team·tmux Team·Autopilot·Ralph·UltraQA 등 여러 loop와 실행 권위가 공존한다.',
    adopted: '계획·구현·검토 단계 분리, 명령 검증과 모델 reviewer 분리, architect·reviewer read-only와 maker write 권한 분리.',
    excluded: '19 agent, native Team·tmux worker, 자동 병렬화·learned memory, 중첩 completion loop와 자동 fix 반복.',
  },
  {
    name: 'OMX · Oh My Codex',
    strengths: 'Codex 엔진을 유지하면서 durable goal, doctor, evidence, worktree 격리와 smoke test를 보강한다.',
    weaknesses: 'Codex CLI·tmux 중심이며 hook·skill·worktree·.omx 상태를 함께 배워야 한다. 앱 경로는 덜 지원된다.',
    adopted: 'doctor, 실행 전 route 미리보기, .relay10/runs의 공개 evidence, artifact hash와 frozen replay.',
    excluded: '/goal DSL, checkpoint·resume, worktree·tmux team·HUD·hook, 여러 completion loop와 광범위 자율 권한.',
  },
  {
    name: 'GJC · Gajae-Code',
    strengths: 'host를 패치하지 않는 external harness이며 공개 workflow와 기본 역할 수가 비교적 좁고 명료하다.',
    weaknesses: '겉의 명령은 작지만 TUI·Rust·Python·tmux·RPC·Telegram·notebook·computer-use를 포함한 experimental beta다.',
    adopted: 'external wrapper 경계, 작은 CLI 명령 집합, maker만 쓰기 가능하게 한 역할 권한, 근거 파일 보존.',
    excluded: '자체 TUI·native binary, tmux·worktree team, RPC·Bridge·Telegram, RLM notebook, computer-use, 다중 runtime 묶음.',
  },
  {
    name: 'LazyCodex',
    strengths: 'OMO Codex Light를 한 줄 install·doctor·uninstall 흐름으로 포장해 초기 도입이 단순하다.',
    weaknesses: '독립 엔진이 아니라 OMO 배포 layer이며 세 이름과 plugin cache·hook·config 변경, OMO SUL 조건이 함께 따라온다.',
    adopted: '짧은 quick start, 하나의 r10 진입점, 설치 직후 doctor로 상태를 확인하는 UX.',
    excluded: 'Codex plugin 주입, 전역 config 자동 변경, marketplace·startup hook, OMO submodule과 SUL 코드. 한 줄 설치·upgrade·uninstall은 아직 미구현.',
  },
  {
    name: 'Ouroboros',
    strengths: '저장소 사실과 인간 결정을 분리하는 소크라틱 인터뷰, 명시적 Seed, 실행·평가·진화까지 이어지는 철학 레이어가 강하다.',
    weaknesses: 'DB·MCP·TUI·runtime adapter·Ralph loop·ontology까지 포함한 Agent OS라 작은 작업에는 설정·상태·운영 비용이 커질 수 있다.',
    adopted: 'repo fact를 먼저 확인하고, 사람만 정할 수 있는 중대한 결정만 한 번에 하나씩 기본 최대 3개 묻고, 실행 전 Confirmed Task Contract를 만들며 의도 변경은 새 revision으로 남기는 흐름.',
    excluded: '코드·prompt·Seed schema 복제, 수치 ambiguity score, ontology, DB·EventStore, MCP·TUI, Ralph loop, resume/evolve 자동화, Claude·Grok 등 multi-runtime 지원 주장.',
  },
];

const comparisonSummary = '여기서 체리피킹은 소스 코드 복제가 아니라 공개 동작 패턴의 clean-room 독립 구현을 뜻한다. 국내 여섯 프로젝트에서는 역할별 모델, 단계 분리, doctor·evidence, external wrapper, 단순한 진입 UX만 골랐다. 글로벌 저장소에서는 권한 분리, write 전 checkpoint, architect/editor, stateless transcript, recipe success gate, worker/reviewer adapter, progressive disclosure를 보강했다. Ouroboros에서는 전체 Agent OS가 아니라 제한된 소크라틱 확인과 revision이 있는 작업 계약만 기존 relay10-spec에 넣었다. Relay10은 위험·파급·검증 가능성·되돌림 가능성 router와 correctness·clarity 분리, hash-bound Reader-10을 유지한다.';

const supportMatrix = [
  { target: 'Codex CLI + 현재 OpenAI 모델', status: 'pass', current: '지원·검증됨', reason: '모든 stage가 codex exec를 호출하고 codex debug models로 catalog를 읽는다. 현재 출시 검증 경로다.', required: '추가 작업 없음. Node 20+, 인증된 Codex CLI 필요.' },
  { target: 'Codex + xAI/Grok custom provider', status: 'warn', current: '실험 후보·미검증', reason: 'Codex custom provider와 xAI가 Responses API를 제공해 프로토콜 조건은 맞지만 Relay10 종단간 검증과 단계별 provider 선택은 없다.', required: 'user-level xAI profile, 모델 override, effort high 이하, 파일 도구·검색·schema·Reader-10 E2E 검증.' },
  { target: 'OpenAI Responses API 직접', status: 'fail', current: '미지원', reason: 'Relay10은 HTTP API client가 아니라 Codex subprocess wrapper이며 provider 설정도 없다.', required: 'catalog·executor adapter와 로컬 file/shell/search tool loop 또는 agent host.' },
  { target: 'Anthropic/Claude API 직접', status: 'fail', current: '미지원', reason: '현재 Codex custom provider는 Responses 규격에 결합되고 Claude의 공식 호환 표면은 Chat Completions이며 네이티브는 Messages API다.', required: 'Anthropic native executor 또는 Responses 변환 proxy와 tool runtime.' },
  { target: 'Google Gemini API 직접', status: 'fail', current: '미지원', reason: 'Gemini의 OpenAI 호환 표면은 Chat Completions이며 Relay10에는 Gemini catalog·executor가 없다.', required: 'Gemini native executor 또는 Responses 변환 proxy와 tool runtime.' },
  { target: '한 run의 OpenAI·Grok·Claude 혼합', status: 'fail', current: '미지원', reason: 'stage config에는 model만 있고 providerId·profile·capability negotiation이 없다.', required: 'stage별 providerId, adapter registry, effort·tool·schema capability 검사.' },
  { target: 'Codex App·CLI·IDE Skill', status: 'warn', current: 'main preview·간접 실행', reason: 'main에 repo-scoped 8 Skill과 유효한 Plugin manifest가 있다. Skill이 r10을 안내·호출해도 내부 실행은 별도 Codex CLI이며 현재 task 모델을 바꾸지 않는다.', required: '실제 surface별 trigger forward test와 marketplace packaging. native progress는 local MCP가 별도로 필요.' },
  { target: 'Claude Code·Grok Build Skill host', status: 'warn', current: 'main의 PR #2/#3에서 발견 경로 검증', reason: 'PR #3은 Claude plugin과 Grok Build가 canonical 8 Skill을 찾는 것을 실측했다. 그러나 이 새 contract 행동은 아직 두 host에서 재실행하지 않았고, Grok stage provider를 뜻하지 않는다.', required: 'main의 동일 outcome fixture를 Claude Code와 Grok Build에서 반복.' },
  { target: 'ChatGPT 앱·웹', status: 'fail', current: '미지원', reason: 'ChatGPT App UI나 remote MCP backend가 없고 로컬 Mac repo에 직접 접근하는 구조도 아니다.', required: 'Apps SDK UI, remote MCP worker 또는 안전한 local sidecar 연결.' },
  { target: '독립 데스크톱 GUI', status: 'fail', current: '미구현', reason: '현재 package는 r10·relay10 CLI bin만 제공한다.', required: 'core 분리 뒤 Codex App Server client 또는 provider-neutral local sidecar와 Electron·Tauri·Swift UI.' },
];

const supportSummary = '고정 v0.1.1 release의 공식 stage 실행 지원은 Codex CLI뿐이고 현재 OpenAI 경로만 실제 검증했다. main은 PR #2/#3으로 Codex App·CLI·IDE, Claude Code, Grok Build가 읽을 수 있는 canonical 8 Skill과 두 manifest를 포함한다. Claude Code와 Grok Build의 Skill-host 발견 경로는 검증했지만 새 contract 행동과 xAI/Grok stage 실행은 검증하지 않았다. Plugin에는 MCP·custom UI·현재 task model 전환이 없고 Claude·Gemini 직접 연결과 한 run 공급자 혼합도 미지원이다. host discovery와 stage executor를 구분하고, surface별 행동·종단간 검증 전에는 앱 native 또는 multi-provider 지원으로 표시하지 않는다.';

const verificationChecks = [
  ...verificationLog.commands.map((command) => ({
    name: command.label,
    passed: command.passed,
    detail: `${command.commandLine}; 시작 ${command.startedAt}; 종료 코드 ${command.code}; ${command.durationMs}ms; 전체 stdout/stderr는 docs/launch-verification.json에 기록.`,
  })),
  { name: 'HTML 안전·접근성 구조', passed: true, detail: '외부 스크립트 없음, 출력 이스케이프, URL 허용목록, 콘텐츠 보안 정책, 모바일 viewport, main/h1/표 머리글 검사.' },
  { name: '현재 HTML 실제 모델 판독', status: 'warn', detail: '생성 시점에는 대기 상태다. npm run audit:launch가 완성된 HTML을 읽고 10회 결과와 이 HTML의 reportSha256을 docs/launch-reader-live.json에 기록한다. 제품 v0.1.1 공개 상태와는 별개다.' },
];

const stages = [
  {
    title: '검수 상태를 읽는 법', status: 'warn', profile: '최종 보고 게이트', model: '@minwoo19930301',
    summary: '제품 출시는 완료됐고, 완성된 이 HTML의 실제 판독은 생성 뒤 별도 파일에 기록한다.',
    output: '제품 상태: v0.1.1 공개 완료.\n자동 구조 검사: 10/10 통과. 프로그램 규칙으로 제목, 링크, 접근성만 확인하며 글의 뜻은 이해하지 못함.\n이 HTML의 실제 모델 판독: 생성 시점에는 대기. 이는 제품 출시 대기가 아님.\n판독 방식: economy 역할 모델 열 번이 목적, 결과, 근거, 위험, 다음 행동을 다시 말함.\n최종 점수 위치: docs/launch-reader-live.json과 outputs/relay10-launch-reader-live.json. passedPersonas 10, criticalCount 0, reportSha256이 이 HTML의 SHA-256과 같아야 통과함.\n치명적 구조 문제: 본문 없음, 실행 가능한 위험 링크, 활성 외부 삽입, 이미지 설명 누락처럼 읽기나 안전을 막는 문제.\n실행 위치: clone한 relay10 저장소의 최상위 폴더.\n수정, 검수 실행, 최종 확인, GitHub 게시 담당: 모두 @minwoo19930301.',
  },
  {
    title: 'OMO(Oh My OpenAgent)', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 가장 넓은 기능과 큰 공개 관심 신호, 단점은 큰 운영 표면과 라이선스 제약이다.',
    output: '사실: OpenCode Ultimate와 Codex Light를 한 계열에서 제공하며 11 agents, 54+ hooks, 도구·팀·복구 기능을 묶는다. 장점: 기능 폭과 생태계 신호가 크다. 단점: 상태·hook·도구의 상호작용이 많아 작은 하네스보다 진단 비용이 높다. 주의: 코어는 MIT가 아니라 Sustainable Use License 1.0이다. Relay10은 코드를 복제하지 않은 클린룸 구현을 택했다.',
    evidence: [{ title: 'OMO 공식 README와 라이선스', url: 'https://github.com/code-yeongyu/oh-my-openagent' }],
  },
  {
    title: 'OMP(Oh My Pi)', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 완성형 독립 엔진, 단점은 경량 라우터보다 훨씬 큰 구현·배포 범위다.',
    output: '사실: 자체 터미널 화면, 언어 서버, 디버거, 실행 환경, 하위 에이전트, 검색과 여러 공급자를 포함한 독립 코딩 에이전트다. 장점: 호스트 플러그인 한계를 벗어난 깊은 도구 통합과 MIT 라이선스. 단점: TypeScript·Rust·Python과 네이티브 기능을 함께 품어 단순한 Codex 래퍼의 기준에는 무겁다.',
    evidence: [{ title: 'OMP 공식 README', url: 'https://github.com/can1357/oh-my-pi' }],
  },
  {
    title: 'OMC(Oh My ClaudeCode)', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 단계형 팀 실행, 단점은 여러 반복 실행 모드와 Claude Code 중심 경계다.',
    output: '사실: Claude Code 플러그인과 명령줄 도구로 계획·요구사항·실행·검증·수정 흐름과 전문 역할을 제공한다. 장점: staged team workflow가 명시적이다. 단점: Team, Autopilot, Ralph, UltraQA, tmux worker처럼 실행 권위가 여러 곳에 생길 수 있어 상태 소유권을 관리해야 한다.',
    evidence: [{ title: 'OMC 공식 README', url: 'https://github.com/Yeachan-Heo/oh-my-claudecode' }],
  },
  {
    title: 'OMX(Oh My Codex)', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 Codex 위 durable goal·worktree 흐름, 단점은 설정·tmux·상태 학습면이다.',
    output: '사실: Codex 위에 deep-interview, ralplan, ultragoal, /goal, 격리 Git 작업공간과 터미널 세션 도구를 얹는다. 장점: 목표·근거·격리 작업공간을 오래 유지하는 운영 흐름. 단점: 설치 범위, 자동 연결 동작, 터미널 세션, 격리 작업공간, .omx 상태를 이해해야 한다. README는 MIT를 말하지만 조사 시점 root 표준 LICENSE 파일은 비어 있어 재사용 전 재확인이 필요하다.',
    evidence: [{ title: 'OMX 공식 README', url: 'https://github.com/Yeachan-Heo/oh-my-codex' }],
  },
  {
    title: 'GJC(Gajae-Code)', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 좁은 공개 workflow, 단점은 내부 구현과 실험 기능이 여전히 크다는 점이다.',
    output: '사실: 독립 외부 실행 도구이며 deep-interview, ralplan, ultragoal, 선택적 team과 네 기본 역할을 앞세운다. 장점: 사용자에게 보이는 기본 방법이 비교적 작고 MIT다. 단점: 내부에는 TypeScript·Rust·Python, 터미널 화면, 터미널 세션, 원격 통신, Telegram, notebook research가 있어 배포물은 가볍지 않으며 스스로 experimental beta라고 밝힌다.',
    evidence: [{ title: 'GJC 공식 README와 NOTICE', url: 'https://github.com/Yeachan-Heo/gajae-code' }],
  },
  {
    title: 'LazyCodex', status: 'pass', profile: '국내 비교', model: '공식 저장소',
    summary: '장점은 한 줄 설치, 단점은 독립 엔진이 아니라 OMO Codex Light 배포층이라는 점이다.',
    output: '사실: OMO의 Codex Light를 설치·문서·marketplace로 배포하는 레이어이며 core를 submodule로 포함한다. 장점: 도입과 doctor 경험이 단순하다. 단점: LazyCodex, OMO, marketplace 이름이 동시에 노출되고 wrapper의 MIT가 OMO core의 Sustainable Use License를 덮지 않는다. OMO와 별도 엔진처럼 중복 집계하면 안 된다.',
    evidence: [{ title: 'LazyCodex 공식 README와 submodule', url: 'https://github.com/code-yeongyu/lazycodex' }],
  },
  {
    title: 'Ouroboros', status: 'pass', profile: '글로벌 비교·철학 레이어', model: '공식 커밋 456a134',
    summary: '전체 Agent OS가 아니라 모호한 작업을 실행 가능한 계약으로 바꾸는 얇은 인터뷰 패턴만 가져왔다.',
    output: '사실: Ouroboros는 소크라틱 interview에서 Seed를 만들고 execute→evaluate→evolve로 잇는 Agent OS다. 장점: 모델이 바뀌어도 의도·제약·평가 기준을 먼저 명시하는 철학 레이어가 남는다. 단점: DB·MCP·TUI·runtime adapter·Ralph loop·ontology까지 포함해 작은 하네스에는 운영 표면이 크다. Relay10 채택: 저장소 사실 선확인, 사람만 정할 결정 한 번에 하나·기본 최대 3개, 실행 전 Confirmed Task Contract, 의도 변경 시 새 revision. 제외: 코드·prompt·Seed schema, ambiguity score, ontology, DB·EventStore, MCP·TUI, Ralph·resume·evolve, multi-runtime 지원 주장. 이 계약은 Skill 규율이지 암호학적으로 고정된 runtime Seed가 아니다.',
    evidence: [
      { title: 'Ouroboros 공식 저장소 고정 커밋', url: 'https://github.com/Q00/ouroboros/tree/456a1347195038ad0eea2bcfee21efee495d6cb9' },
      { title: 'Relay10 Ouroboros 증류 결정', url: `${repository}/blob/main/docs/ouroboros-distillation.md` },
    ],
  },
  {
    title: '글로벌 상위 저장소 재조사', status: 'pass', profile: '해외 조사', model: 'GitHub API·공식 README',
    summary: '상위 agent runtime뿐 아니라 spec workflow, minimal core, Skill 표준과 현재 Plugin 배포 경로까지 다시 비교했다.',
    output: '2026-07-14 스냅샷의 current core reference 12개는 OpenCode, Claude Code, Spec Kit, Gemini CLI, Codex, OpenHands, Cline, Ruflo, Goose, Aider, Agent Orchestrator, mini software-engineering agent다. Skills는 Superpowers, Anthropic Skills, Awesome Copilot, Vercel Agent Skills, Agent Skills, Microsoft Skills, 현재 OpenAI Plugins를 비교했다. OpenSpec·BMAD는 인접 workflow 사례, openai/skills는 deprecated, Continue는 no longer actively maintained/read-only, Roo Code는 archived로 구분했다. 별은 발견 신호일 뿐 품질·시장점유율·생산성 증거가 아니다.',
    evidence: [
      { title: '글로벌 상위 저장소 증류표', url: `${repository}/blob/main/docs/global-top-repos.md` },
      { title: 'Clean-room prior art ledger', url: `${repository}/blob/main/docs/prior-art.md` },
    ],
  },
  {
    title: '여덟 개 Skill·Plugin preview', status: 'pass', profile: 'progressive disclosure', model: 'Agent Skills·Codex Plugin 규격',
    summary: '수백 개 catalog 대신 research·spec·build·debug·review·release·orchestrate·skill-lab 여덟 개만 필요할 때 로드한다.',
    output: 'main에 Codex·Claude Code manifest와 여덟 SKILL.md, UI metadata, provenance, third-party notice를 구현했다. .agents/skills와 .claude/skills는 같은 canonical plugin skills 폴더를 가리킨다. npm run validate:skills와 전체 회귀 테스트가 manifest·frontmatter·UI metadata·상대 링크·placeholder를 검사해 통과했다. 이번 relay10-spec 정성 검사에서는 held-out 8건이 기대 분류와 같았지만 정확한 모델·노력도·token·시간·raw trace가 없어 행동 검증은 warning이다. 기본 모델도 파괴 작업을 막았으므로 우월성을 주장하지 않는다. 병합된 PR #3은 Claude Code와 Grok Build가 canonical pack을 발견하는 것까지 확인했지만 새 contract 행동 검사는 아직이다. Skill은 현재 task model을 바꾸지 않으며 Plugin에는 MCP server·hook·custom UI가 없다.',
    evidence: [
      { title: 'Relay10 Plugin preview', url: `${repository}/tree/main/plugins/relay10` },
      { title: 'Codex Skill 공식 문서', url: 'https://learn.chatgpt.com/docs/build-skills' },
      { title: 'Codex Plugin 공식 문서', url: 'https://learn.chatgpt.com/docs/build-plugins' },
    ],
  },
  {
    title: 'Relay10 라우팅 설계', status: 'pass', profile: 'frontier', model: 'gpt-5.6-sol / max 원칙',
    summary: '위험 차원별 모델 배정에 scout 이후 조건부 frontier advisor를 결합했다.',
    output: '기본 정책: 읽기·검색은 economy/low, 구현은 balanced/medium, 사실 검토는 frontier/high, 쉬운 설명은 balanced/low, 마지막 독자 검수는 economy/low 10회다. 모든 advisor 판단은 scout 이후 checkpoint에서 이뤄진다. 비-economy 작업은 그 시점에 frontier/max advisor를 항상 호출하고, economy 작업은 scout가 미결 질문을 남길 때만 같은 advisor를 호출한다. advisorMode always·never로 이전 정책이나 완전 비활성화로 되돌릴 수 있다. 복잡성, 위험, 영향 범위, 검증 가능성, 되돌림 가능성을 0~3으로 기록한다. 이 구조는 조건부 호출을 가능하게 할 뿐 실제 token·시간·정확도·비용 절감은 아직 forward evaluation 전이다. Relay10 자체에는 /goal 명령 문법이 없다.',
  },
  {
    title: '경량·안전 구현', status: 'pass', profile: 'balanced', model: 'Node 20+ 내장 모듈',
    summary: '별도 데이터베이스·터미널 화면·runtime npm 패키지 없이 Codex subprocess와 파일 계약만 둔다.',
    output: '명령: init, doctor, route, run, inspect, report, replay. 안전 경계: 프로젝트가 모델 목록 확인 명령을 바꾸지 못함, 검증은 실행 파일과 인수 목록을 사람이 승인한 경우만 허용, 명령 해석기 없이 실행, 시간 초과 시 자식 실행 묶음 종료, 출력 크기 제한, 변경 실행 잠금, 실행 식별자 경로 제한, 안전한 파일 교체, 검토 근거 요구, 누락 검증은 통과 대신 주의, 파일 해시가 바뀌면 동결 재생 거부.',
  },
  {
    title: '출시·운영 안내', status: 'pass', profile: '공개 릴리스', model: '@minwoo19930301',
    summary: 'v0.1.1은 공개됐고 v0.1.0의 예제 설정 누락을 바로잡은 현재 배포본이다.',
    output: `현재 상태: v0.1.1 고정 release 공개 완료, main에 글로벌 문서와 Skill·Plugin preview 보강. 기존 tag는 움직이지 않는다.\n저장소: ${repository}\n공개 릴리스: ${releaseTarget}\n로컬 설치: git clone ${repository}.git && cd relay10 && npm link\n검증: npm test && npm run lint && npm run validate:skills && r10 doctor\n모델 배정 확인: r10 route "research and build a small CLI" --json\n실행 전 미리보기: r10 run "your task" --dry-run\n실제 독자 검수 기록: docs/launch-reader-live.json 및 outputs/relay10-launch-reader-live.json. reportSha256으로 검수 대상 HTML과 연결함.\n수정·검수 실행·최종 확인·GitHub 게시 담당: @minwoo19930301. 0.1 평가 제안은 읽기 10건, 구현 10건, 고위험 미리보기 10건에서 기대 모델 배정과 실패 상태를 기록하는 것이다. 완료 기준은 30건 전체에 기대 배정 라벨, 허위 통과 0건, 치명적 독자 문제 0건이다. 비교 코드 재사용이나 OMO 계열 상업 사용이 생기면 별도 라이선스 검토를 연다.`,
  },
];

const nextSteps = [
  `설치: git clone ${repository}.git && cd relay10 && npm link`,
  '검증: npm test && npm run lint && r10 doctor',
  '안전한 첫 확인: r10 route "research and build a small CLI" --json 후 --dry-run 옵션으로 실제 변경 없이 계획만 확인한다.',
  '담당자 @minwoo19930301이 clone한 relay10 저장소의 최상위 폴더에서 npm run audit:launch를 실행해 이 HTML을 10회 판독한다. 10/10 미만 또는 치명적 구조 문제 1개 이상이면 최종 보고를 통과 처리하지 않는다.',
  '실패하면 outputs/relay10-launch-reader-live.json의 “막힌 모호점” 목록을 고치고 HTML을 다시 생성한 뒤 10회 전체를 재실행한다.',
  '공개 상태 확인: gh repo view minwoo19930301/relay10 및 gh release view v0.1.1 --repo minwoo19930301/relay10. 릴리스 주소는 이미 공개됐으며 결과 파일은 reportSha256으로 현재 HTML과 일치 여부를 확인한다.',
  '30개 라우팅 평가 세트를 @minwoo19930301이 관리한다. 실측 전에는 비용·속도·품질 우월성을 광고하지 않는다.',
  'main의 8 Skill은 npm run validate:skills로 검사하고, 각 Skill에 should-trigger 10개·near-miss 10개와 no-skill baseline을 추가해 Codex App·CLI·IDE에서 forward test한다.',
  'relay10-spec의 초기 isolated with-Skill·no-Skill 정성 관찰은 docs/ouroboros-spec-forward-eval.md에 warning으로 보존했다. 정확한 model·effort·raw output·token/time·failure type을 남기는 runner로 Codex App·CLI에서 반복하고, main의 Claude Code와 Grok Build에서 같은 fixture를 다시 확인한다. xAI/Grok stage executor는 파일 도구·검색·구조화 출력·Reader-10 종단간 검증 전까지 지원으로 표시하지 않는다.',
  '30일 필수: 공개 fixture 4개와 실제 저장소 golden demo 1개를 만들고, opt-in tester 5명 중 4명이 5분 안에 first dry-run을 끝내는지 관찰한다. fixture 12개·demo 3개는 stretch다.',
  '60일: CatalogAdapter·ExecutorAdapter·SurfaceAdapter 설계와 Skill with/without 결과를 공개한다. local MCP와 provider adapter 중 사용자 수요가 큰 하나를 선택한다.',
  '90일: 선택한 확장 하나만 E2E tool·schema·search·workspace·Reader-10 gate 뒤 release 후보로 만든다. 통과 전에는 Grok·Claude·Gemini 또는 앱 native 지원으로 광고하지 않는다.',
  '홍보: 기능 목록이나 별 요청보다 무편집 demo, 재현 명령, 실패 로그, unsupported 목록, 실제 사용자 case study를 한국어·영어로 나눠 공유한다.',
];

const base = {
  title: 'Relay10 글로벌·Ouroboros 증류 보고서',
  heroSummary: '글로벌 상위 agent·workflow·Skill 저장소와 Ouroboros를 조사해 권한 분리, checkpoint, 작은 core, 독립 review, progressive disclosure에 더해 제한된 소크라틱 작업 계약만 여덟 Skill로 압축했다. 새 Agent OS는 만들지 않았고 고정 v0.1.1의 공식 실행 지원은 여전히 Codex CLI뿐이다.',
  task,
  summary: ouroborosSummary,
  runId: 'relay10-launch-20260713',
  generatedAt: new Date().toISOString(),
  status: 'warn',
  routing: {
    decisions: [
      { stage: '자료 읽기·검색', profile: 'economy', effort: 'low', model: '현재 로컬: gpt-5.6-luna', enabled: true, reason: '되돌릴 수 있고 구조 검증이 쉬운 수집' },
      { stage: '분석·조건부 자문', profile: 'frontier', effort: 'max', model: '현재 로컬: gpt-5.6-sol', enabled: true, reason: 'scout 이후 비-economy는 항상, economy는 미결 질문이 있을 때만 호출' },
      { stage: '구현', profile: 'balanced', effort: 'medium', model: '현재 로컬: gpt-5.6-terra', enabled: true, reason: '계획과 테스트가 구현 범위를 제약' },
      { stage: '정확성 검토', profile: 'frontier', effort: 'high', model: '현재 로컬: gpt-5.6-sol', enabled: true, reason: '이해도 검수 전에 사실·안전 문제 확인' },
      { stage: '쉬운 설명', profile: 'balanced', effort: 'low', model: '현재 로컬: gpt-5.6-terra', enabled: true, reason: '검증 기록을 짧은 문장으로 변환' },
      { stage: 'Reader-10', profile: 'economy', effort: 'low', model: '현재 로컬: gpt-5.6-luna', enabled: false, reason: 'HTML 생성 단계에서는 건너뛰고, 완성 뒤 audit:launch가 10회 호출' },
    ],
  },
  globalRepos,
  globalSummary,
  skillPack,
  skillSummary,
  comparisons,
  comparisonSummary,
  supportMatrix,
  supportSummary,
  growthPlan,
  growthSummary,
  stages,
  verification: { checks: verificationChecks },
  evidence,
  nextSteps,
};

const payloadGate = evaluateReader10Payload({
  task,
  summary: ouroborosSummary,
  evidence,
  verification: { checks: verificationChecks },
  risks,
  nextSteps,
}, { minPass: 10 });
if (!payloadGate.passed) {
  const failed = payloadGate.personas
    .filter((persona) => !persona.passed)
    .map((persona) => ({ id: persona.id, recommendations: persona.recommendations }));
  throw new Error(`Launch payload failed structural Reader-10: ${JSON.stringify({ critical: payloadGate.criticalIssues, failed })}`);
}

const final = generateReport({
  ...base,
  reader10: {
    version: 1,
    mode: 'pending-live',
    status: 'warn',
    semanticVerified: false,
    passedPersonas: 0,
    totalPersonas: 10,
    minPass: 10,
    criticalCount: 0,
    personas: [],
  },
});
const renderAudit = evaluateReader10(final, { minPass: 10 });
if (!renderAudit.passed) {
  const failed = renderAudit.personas
    .filter((persona) => !persona.passed)
    .map((persona) => ({ id: persona.id, recommendations: persona.recommendations }));
  throw new Error(`Launch HTML failed render audit: ${JSON.stringify({ critical: renderAudit.criticalIssues, failed })}`);
}

const deterministicAudit = {
  version: 1,
  generatedAt: new Date().toISOString(),
  payloadGate,
  renderAudit,
};
// docs/launch-report.html and docs/launch-reader-deterministic.json are frozen
// v0.1.1 Relay10 evidence: launch-reader-live.json records a reportSha256 bound
// to the exact bytes of the HTML. Regenerating in place breaks that binding, so
// the shared guard writes to outputs/ unless --freeze and
// REIN_ALLOW_FROZEN_OVERWRITE=1 are both supplied. Note that regeneration can no
// longer byte-reproduce the archive anyway: the report embeds a fresh
// generatedAt timestamp and src/report.mjs now renders the Rein product name.
// Compare the two files by content, not by hash.
await writeEvidence(root, reportDestination, final);
await writeEvidence(root, deterministicDestination, `${JSON.stringify(deterministicAudit, null, 2)}\n`);
await writeFile(path.join(outputs, 'relay10-launch-report.html'), final, 'utf8');
process.stdout.write(`launch report: payload ${payloadGate.passedPersonas}/10, render ${renderAudit.passedPersonas}/10, ${renderAudit.criticalCount} critical\n`);
process.stdout.write(`report: ${describeTarget(root, reportDestination)}\nreader log: ${describeTarget(root, deterministicDestination)}\n`);
