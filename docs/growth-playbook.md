# Decant 30/60/90 development and promotion playbook

기준일: **2026-07-14**. 이 계획의 목표는 별 수를 빠르게 늘리는 것이 아니라,
처음 온 사람이 안전하게 한 번 성공하고 30일 안에 다시 쓰는 제품을 만드는 것이다.

## 한 문장 포지셔닝

> Decant은 Codex를 갈아엎지 않고, 읽기·계획·구현·검토·설명을 위험도에
> 맞게 나누고 모든 handoff를 파일로 남기는 작은 harness다.

지금 말할 수 있는 범위는 “Codex CLI에서 검증됨, main에 여덟 Skill과
Codex·Claude Code Plugin preview가 있음”이다. “가장 싸다”, “가장 똑똑하다”,
“Grok·Claude·Gemini 지원”, “Codex App native 지원”은 아직 증명되지
않았으므로 쓰지 않는다.

## North-star와 보조 지표

North-star는 **동의한 tester cohort에서 30일 안에 두 번째 성공 run을 만든
외부 사용자 수**다. Decant core에 추적 telemetry를 넣지 않는다. 첫 성공 날짜,
익명 run ID, 7일·30일 재사용 여부를 tester가 동의한 인터뷰·제출 form으로만
기록한다. 단순 clone, star, page view는 사용자 단위 funnel로 연결할 수 없으므로
aggregate 보조 지표로만 본다.

| 층 | 측정값 | 이유 |
|---|---|---|
| 첫 접점 | 익명 설문 응답자의 README 이해, demo 완주 | 설명과 기대가 맞는지 opt-in 관찰로 본다. |
| 활성화 | opt-in tester의 doctor 성공, clone→첫 `route` 시간 | 설치·첫 경험의 마찰을 관찰 세션으로 찾는다. |
| 가치 | 기대 stage/model label 일치, 실제 task 완료, 허위 PASS | router와 evidence contract가 쓸모 있는지 본다. |
| 유지 | 7일·30일 재사용자, 사용자당 두 번째 run | 호기심이 아닌 반복 가치를 본다. |
| 생태계 | 재현 가능한 issue, 외부 PR, case study | 혼자 만든 demo를 넘어섰는지 본다. |

## 0~30일: 첫 성공을 증명한다

### 제품

- macOS와 Linux에서 `clone → npm link → decant doctor → route → dry-run`을 한
  문서로 고정한다. Windows는 검증 전까지 실험 또는 미지원으로 표시한다.
- 필수 gate는 research, bug fix, small feature, release check 공개 fixture 4개와
  실제 저장소 golden demo 1개다. stretch goal로 fixture 12개와 demo 3개까지 늘린다.
- 각 fixture에 입력, 예상 route, 호출 상한, 실행 명령, raw artifact, 실패 복구를
  함께 두고 raw Codex CLI와 비교할 때는 model·effort·call budget을 같게 둔다.
- 30개 routing set을 고정하는 것은 stretch goal이다. 필수 gate는 읽기·구현·
  고위험 각 4개, 총 12개다.
- 여덟 Skill마다 should-trigger와 near-miss를 먼저 각 3개씩 만들고
  tuning/validation을 분리한다. 각 10개는 60일 stretch goal이다. 아직 model
  trigger 결과가 없으면 “static validation”만 표시한다.
- 준비된 `CONTRIBUTING.md`와 bug·use case·Skill issue form을 실제 피드백에
  사용한다. GitHub Issues는 재현 가능한 bug·task에, Discussions는
  아이디어·질문·투표에 쓴다. GitHub도 이 구분을 권한다.
  [GitHub community communication](https://docs.github.com/en/get-started/using-github/communicating-on-github)

### 공개할 증거

- 90초짜리 무편집 terminal demo 한 편;
- 같은 task의 `route --json`, `run --dry-run`, artifact tree, 최종 report;
- 실패 하나와 어떻게 진단했는지 보여주는 짧은 postmortem;
- 테스트·Skill validator·package 검사 원문과 commit SHA;
- “지원/실험/미지원” 표.

### 목표

- 필수 외부 tester 5명, stretch 10명;
- 필수 5명 중 4명 이상이 도움 없이 5분 안에 doctor와 first dry-run 성공;
- blocker issue 48시간 안에 첫 응답;
- 허위 PASS와 잘못된 provider/app 지원 claim 0건.

## 31~60일: 반복성과 Skill 가치를 증명한다

### 제품

- `CatalogAdapter`, `ExecutorAdapter`, `WorkspaceAdapter`, `SurfaceAdapter` ADR을
  쓰되 구현은 한꺼번에 하지 않는다.
- Skill을 쓴 run과 쓰지 않은 run을 같은 task에서 비교한다. 품질, token, 시간,
  실패 유형, tool call을 raw artifact와 함께 공개한다.
- trigger validation recall 90% 이상, near-miss false trigger 10% 이하를 목표로
  하되 sample 수와 model을 함께 공개한다.
- clean clone CI와 supported Node/macOS/Linux matrix를 추가한다.
- 실제 요청을 분류해 local MCP surface와 provider adapter 중 수요가 큰 하나를
  90일 구현 대상으로 고른다.

### 운영

- 주 1회 build log: 이번 주에 바뀐 사실, 실패, 다음 실험만 쓴다.
- “기능 요청”을 바로 만들지 말고 use case, 현재 우회로, 성공 조건을 먼저 받는다.
- 10건의 외부 issue 중 70% 이상을 재현 가능하게 만드는 것을 목표로 한다.
- 최소 3명의 재사용자, 외부 문서 PR 또는 코드 PR 1건을 목표로 한다.
- GitHub Traffic의 views·unique visitors·clones와 release download를 주 단위로
  보존하되, 제품 가치 KPI가 아닌 funnel 보조 지표로 본다.

## 61~90일: 수요가 검증된 확장 하나만 출시한다

다음 둘 중 하나만 선택한다.

1. **Codex App용 local MCP surface**: `route`, `run`, `status`, `inspect`, `report`를
   앱 도구로 노출하고 진행 상태와 권한을 보이게 한다.
2. **Provider/worker adapter**: 가장 많이 요청된 한 provider 또는 agent CLI를
   stage별 capability negotiation과 함께 종단간 검증한다.

공통 release gate는 catalog, effort, tool, schema, search, workspace write,
timeout, rollback, artifact hash, Reader-10을 포함한다. 한 항목이라도 빠지면
“지원”이 아니라 “실험”이다.

목표는 실제 사용자 case study 2개, **60일 이전 첫 성공한 opt-in tester
cohort**에서 30일 안에 두 번째 성공 run을 만든 비율 30% 이상, 외부 contributor
2명, 치명적 허위 지원 claim 0건이다. 30일 관찰 창이 끝나지 않은 사용자는
분모에서 제외한다.

## 홍보 순서

### 1. GitHub를 먼저 제품처럼 만든다

- README 첫 화면에 한 문장, 30초 quick start, 90초 demo, 지원표를 둔다.
- Issues는 bug/feature/eval 재현 양식으로 나누고, Discussions에는 Q&A,
  Ideas, Show & Tell을 둔다. GitHub Discussions는 maintainer가 category와
  moderation을 운영할 수 있다. [GitHub Discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community)
- release note는 기능 목록보다 “어떤 task가 새로 통과했고 무엇이 아직
  미지원인지”를 먼저 쓴다.

### 2. 국내: GeekNews Show GN

Show GN은 직접 만든 실행 가능한 제품·오픈소스를 시험하고 피드백 받는
공간이다. 소개에는 무엇인지, 왜 만들었는지, 기존 도구와 무엇이 다른지,
기술 세부를 사실적인 언어로 적고, 지인에게 upvote를 부탁하지 않는다.
[Show GN 안내](https://news.hada.io/blog/show)

권장 제목:

> Show GN: Codex를 바꾸지 않고 단계별 모델 역할과 근거를 남기는 Decant

본문 순서: 개인적 문제 → 30초 실행법 → OMO/글로벌 harness와 다른 좁은 선택 →
실제 artifact → 미지원 범위 → 받고 싶은 피드백 2개.

### 3. 해외: Show HN

Show HN은 사용자가 직접 실행할 수 있어야 하며 signup 장벽을 낮추고, 만든
사람이 토론에 참여해야 한다. 단순 landing page·글·작은 버전 업데이트는 맞지
않고 지인 upvote 요청도 금지된다. [Show HN guidelines](https://news.ycombinator.com/showhn.html)

권장 제목:

> Show HN: Decant – a small evidence-first router for Codex tasks

README를 영어로 읽을 수 있고, clean install이 되며, 세 개 demo와 raw evidence가
준비된 뒤 한 번만 올린다.

### 4. Product Hunt는 90일 뒤 판단한다

Product Hunt는 실제 사용할 수 있는 live product와 준비된 launch를 전제로 한다.
현재 CLI preview를 급히 올리기보다 app surface나 반복 사용자 case study가 생긴
뒤가 낫다. [Product Hunt Launch Guide](https://www.producthunt.com/launch)

## 매주 maintainer가 할 일

| 요일 | 30~60분 행동 |
|---|---|
| 월 | 새 issue를 bug·question·use case로 분류하고 재현 정보를 요청한다. |
| 화 | 실제 저장소 하나에서 golden task를 다시 실행한다. |
| 수 | 가장 자주 막힌 onboarding 한 곳만 고친다. |
| 목 | Skill trigger 또는 routing eval을 갱신한다. |
| 금 | 사실·실패·다음 실험으로 된 짧은 build log를 쓴다. |
| 매주 | 최대 2명에게 직접 사용을 요청하고 첫 15분을 관찰한다. 7일·30일 뒤 재사용 여부를 묻는다. |
| 출시 주 | clean clone, package, hash, support matrix, Reader-10을 다시 묶는다. |

관찰 기록과 showcase를 공개하기 전 사용자의 동의를 받고 credential, 개인 정보,
private repository 내용, 로컬 경로를 제거한다.

## 홍보에서 하지 않을 것

- 별·모델 이름만으로 “최고”, “최저 비용”, “10배 생산성”이라고 말하지 않는다.
- Grok·Claude·Gemini·Codex App native 지원을 protocol 가능성만으로 선언하지 않는다.
- 다른 harness를 깎아내리거나 국내/해외를 별 수로 승패 처리하지 않는다.
- 여러 커뮤니티에 같은 문구를 같은 날 반복 게시하지 않는다.
- 지인 upvote, 가짜 benchmark, 선택한 성공 사례만 공개하는 비교를 하지 않는다.
- 모든 feature 요청을 core에 넣지 않는다. daemon·DB·GUI·memory·swarm은 수요와
  release gate가 생길 때까지 adapter 또는 별도 surface로 남긴다.

이 playbook은 제품이 변할 때 업데이트한다. 홍보 문구보다 먼저 raw artifact와
지원표를 갱신한다.
