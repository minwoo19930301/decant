# 한국에서 함께 언급되는 코딩 에이전트 하네스 6종

> 스냅샷 기준: **2026-07-13 KST**  
> 범위: 한국어권에서 함께 비교·홍보되는 OMO, OMP, OMC, OMX, GJC, LazyCodex의 공개 GitHub 자료. 이 묶음은 “한국에서 함께 언급되는 제품군”이라는 뜻이며, 모든 프로젝트가 한국에서 시작되었다는 뜻은 아니다.

GitHub stars와 forks는 2026-07-13에 GitHub REST API에서 읽은 값이다. 수치는 계속 변하며, stars/forks는 관심도의 간접 신호일 뿐 설치 수, 활성 사용자, 작업 성공률, 코드 품질을 증명하지 않는다.

## 한눈에 보기

| 이름 | 이 문서에서 가리키는 공식 저장소 | 주 실행 표면 | Stars / forks (2026-07-13) | 최신 공개 릴리스 |
| --- | --- | --- | ---: | --- |
| OMO | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | OpenCode Ultimate + Codex Light | [65,643 / 5,350](https://api.github.com/repos/code-yeongyu/oh-my-openagent) | [v4.17.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.17.0) |
| OMP | [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) | 독립 터미널 코딩 에이전트 | [17,466 / 1,576](https://api.github.com/repos/can1357/oh-my-pi) | [v16.4.8](https://github.com/can1357/oh-my-pi/releases/tag/v16.4.8) |
| OMC | [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | Claude Code 플러그인/CLI | [37,711 / 3,406](https://api.github.com/repos/Yeachan-Heo/oh-my-claudecode) | [v4.15.4](https://github.com/Yeachan-Heo/oh-my-claudecode/releases/tag/v4.15.4) |
| OMX | [Yeachan-Heo/oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) | Codex CLI workflow/runtime layer | [31,942 / 2,471](https://api.github.com/repos/Yeachan-Heo/oh-my-codex) | [v0.20.1](https://github.com/Yeachan-Heo/oh-my-codex/releases/tag/v0.20.1) |
| GJC | [Yeachan-Heo/gajae-code](https://github.com/Yeachan-Heo/gajae-code) | 독립 external runner | [1,846 / 269](https://api.github.com/repos/Yeachan-Heo/gajae-code) | [v0.10.0](https://github.com/Yeachan-Heo/gajae-code/releases/tag/v0.10.0) |
| LazyCodex | [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) | OMO Codex Light 배포 레이어 | [2,710 / 171](https://api.github.com/repos/code-yeongyu/lazycodex) | [core tag v4.17.0](https://github.com/code-yeongyu/lazycodex/releases/tag/v4.17.0); npm wrapper는 별도 버전 |

## OMO — Oh My OpenAgent

### 사실

- OMO는 이전 Oh My OpenCode에서 이름을 바꾼 프로젝트이며, 하나의 저장소에서 OpenCode용 **Ultimate Edition**과 Codex용 **Light Edition**을 제공한다. Ultimate는 11 agents, 54+ lifecycle hooks, 5 built-in MCPs, Team Mode, hash-anchored edits 등을 포함한다. Light는 Codex 플러그인 표면에 맞춘 rules, comment-checker, git-bash, LSP, ultrawork, ulw-loop 등의 이식판이며 자체 `team_*` 도구 대신 Codex의 네이티브 실행 표면을 이용한다. [공식 README의 edition 설명](https://github.com/code-yeongyu/oh-my-openagent#installation)
- 주 구현은 TypeScript 모노레포이며 `packages`, `docs`, `tests`, `.opencode`, `.codex`, `.omo` 등을 함께 둔다. [저장소 트리](https://github.com/code-yeongyu/oh-my-openagent)
- 익명 telemetry가 기본 활성화되어 있고 환경변수로 opt-out할 수 있다. [Telemetry 문서](https://github.com/code-yeongyu/oh-my-openagent#telemetry)
- 라이선스는 MIT가 아니라 **Sustainable Use License 1.0**이다. 내부 업무·개인·비상업 사용과 무료 비상업 배포를 허용하지만 상업적 재배포에는 제한이 있다. [LICENSE.md](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/LICENSE.md)

### 추론

- 장점: 여섯 후보 중 공개 인지도 신호와 기능 폭이 가장 크며, 모델 라우팅·전문 agent·도구·장기 실행 복구를 한 패키지에서 얻을 수 있다.
- 단점: 11 agents와 54+ hooks는 설치 후 진단해야 할 상태와 상호작용 지점을 늘린다. “가볍고 예측 가능한 하네스”보다 “기능이 많은 운영체제형 하네스”에 가깝다.
- 제품화 시 유의점: 새 상업 제품은 OMO의 아이디어를 독립 구현하는 것과 OMO 코드를 복제·재배포하는 것을 구분해야 한다. 후자는 SUL 조건을 먼저 검토해야 한다.

### 명칭 혼선

- 저장소 브랜드는 `oh-my-openagent`지만 root package 이름은 아직 `oh-my-opencode`이고, README는 전환기 호환 이름을 설명한다. 또한 `bunx omo`/`npx omo`는 다른 저자의 무관한 npm 패키지를 잡을 수 있다고 경고한다. [Package and command names](https://github.com/code-yeongyu/oh-my-openagent#note-on-package-and-command-names)

## OMP — Oh My Pi

### 사실

- OMP는 다른 호스트에 붙는 얇은 플러그인이 아니라 Pi 계열의 독립 터미널 코딩 에이전트다. 자체 TUI, hash-anchored edits, LSP, DAP debugger, persistent Python/Bun execution, subagents, 브라우저/검색, 다수 provider를 제공한다. [공식 README](https://github.com/can1357/oh-my-pi)
- interactive TUI, one-shot, Node SDK, RPC, ACP 네 가지 진입 표면을 제공한다. [SDK 문서](https://github.com/can1357/oh-my-pi/blob/main/docs/sdk.md)
- TypeScript 모노레포에 Rust crates와 Python 런타임을 함께 포함한다. [저장소 트리](https://github.com/can1357/oh-my-pi)
- 라이선스는 MIT다. [LICENSE](https://github.com/can1357/oh-my-pi/blob/main/LICENSE)

### 추론

- 장점: 호스트 제품의 플러그인 API에 제한되지 않는 완성형 엔진이며, 도구 I/O 최적화와 임베딩 표면이 강하다. MIT라 독립 구현의 참고·재사용 경계도 상대적으로 명료하다.
- 단점: 자체 TUI, 네이티브 core, 수십 provider, 검색, LSP/DAP, 브라우저를 모두 품으므로 “간단한 모델 라우터”의 출발점으로는 크고 복잡하다. 빠른 릴리스 속도만큼 회귀 검증 비용도 고려해야 한다.

### 명칭 혼선

- `OMP`는 일반 기술 검색에서 OpenMP의 통상 약어와 강하게 충돌한다. 제품명을 외부에 쓸 때는 `Oh My Pi` 또는 `oh-my-pi`를 함께 표기해야 식별된다.

## OMC — Oh My ClaudeCode

### 사실

- 이 문서의 OMC는 `Yeachan-Heo/oh-my-claudecode`다. Claude Code용 multi-agent orchestration plugin/CLI이며, canonical Team pipeline을 `team-plan → team-prd → team-exec → team-verify → team-fix`로 설명한다. [Team Mode](https://github.com/Yeachan-Heo/oh-my-claudecode#team-mode-recommended)
- 19 specialized agents, model tier routing, Autopilot, Ralph, Ultrawork, UltraQA, HUD, tmux 외부 CLI workers를 제공한다. [Features](https://github.com/Yeachan-Heo/oh-my-claudecode#features)
- repo/plugin 브랜드는 `oh-my-claudecode`지만 npm 패키지와 CLI runtime은 `oh-my-claude-sisyphus` 및 `omc` 이름을 쓴다. [설치 및 package naming](https://github.com/Yeachan-Heo/oh-my-claudecode#quick-start)
- 라이선스는 MIT다. [LICENSE](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/LICENSE)

### 추론

- 장점: Claude Code 사용자에게 자연어/skill 진입점과 staged team execution을 제공하고, 계획·실행·검증 역할을 비교적 명시적으로 나눈다.
- 단점: Claude Code가 기본 호스트이고 native team, tmux workers, Ralph, Team, UltraQA 등 여러 반복 실행 권위가 공존한다. 한 세션에서 어느 loop가 최종 상태를 소유하는지 엄격히 제한하지 않으면 운영 복잡성이 커질 수 있다.

### 명칭 혼선

- GitHub에는 `oh-my-claude`라는 이름을 쓰는 별도 statusline, loop, orchestration 프로젝트가 다수 있다. 따라서 OMC만 쓰지 말고 공식 owner/repo를 함께 적어야 한다. [GitHub repository search](https://github.com/search?q=oh-my-claude+in%3Aname&type=repositories)

## OMX — Oh My codeX

### 사실

- OMX는 Codex를 교체하지 않고 그 위에 workflow/runtime를 추가하는 Codex CLI 중심 레이어다. 기본 흐름은 `$deep-interview → $ralplan → $ultragoal`이며 `.omx/`에 plans, logs, memory, runtime state를 둔다. [공식 README](https://github.com/Yeachan-Heo/oh-my-codex#what-omx-is-for)
- `/goal`, worktree launch, tmux team runtime, `omx doctor`, 실제 model-call smoke test를 제공한다. [Recommended default flow](https://github.com/Yeachan-Heo/oh-my-codex#recommended-default-flow)
- 권장 기본 환경은 macOS/Linux의 Codex CLI이며 native Windows와 Codex App은 기본 경로가 아니고 지원이 약할 수 있다고 명시한다. [플랫폼 경고](https://github.com/Yeachan-Heo/oh-my-codex#official-project-and-package)
- README와 package metadata는 MIT를 선언하지만 현재 저장소 root에는 표준 `LICENSE` 파일이 없다. [README License 절](https://github.com/Yeachan-Heo/oh-my-codex#license), [package.json](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/package.json)

### 추론

- 장점: Codex 네이티브 실행을 유지하면서 durable goal/evidence, 격리 worktree, 계획·검증 흐름을 더한다. 위험한 `--madmax` 사용에 별도 worktree를 권하는 운영 안전성도 유용하다.
- 단점: setup scope, plugin/legacy mode, hooks, tmux, worktree, `.omx` 상태를 모두 이해해야 한다. Codex를 “더 간단하게” 쓰려는 사용자에게는 학습·진단 표면이 크다.
- 라이선스 유의점: MIT라는 의도는 명시돼 있지만 코드 재사용·재배포 전에는 표준 라이선스 파일의 추가 여부나 유지보수자의 명시를 다시 확인하는 편이 안전하다.

### 명칭 혼선

- 공식 README는 “OMX v2” 같은 제3자 프로젝트나 fork가 공식 후속판이 아니라고 별도 경고한다. [Official project and package](https://github.com/Yeachan-Heo/oh-my-codex#official-project-and-package)

## GJC — Gajae-Code

### 사실

- GJC는 Codex, Claude Code, OpenCode 안에 숨겨 설치되는 플러그인이 아니라 선택한 repo/worktree 옆에서 실행하는 standalone external harness다. [What is Gajae-Code?](https://github.com/Yeachan-Heo/gajae-code#what-is-gajae-code)
- 공개 기본 workflow는 `deep-interview`, `ralplan`, `ultragoal`, 선택적 `team` 네 개이며, bundled role도 `executor`, `architect`, `planner`, `critic` 네 개로 제한한다. [Workflow surface](https://github.com/Yeachan-Heo/gajae-code#workflow-surface)
- 자체 TUI, tmux/worktree, RPC/Bridge, Telegram reply daemon, RLM notebook research, 실험적 computer-use를 제공한다. [공식 README](https://github.com/Yeachan-Heo/gajae-code)
- 프로젝트는 스스로 experimental beta라고 밝힌다. [README 상단 경고](https://github.com/Yeachan-Heo/gajae-code#recent-highlights)
- GitHub fork로 표시되지는 않지만 NOTICE는 OMP의 “upstream red-claw lineage and implementation DNA”와 OMX/OMC의 workflow 실험을 명시한다. [NOTICE.md](https://github.com/Yeachan-Heo/gajae-code/blob/main/NOTICE.md)
- 라이선스는 MIT다. [LICENSE](https://github.com/Yeachan-Heo/gajae-code/blob/main/LICENSE)

### 추론

- 장점: public method와 기본 역할 수는 여섯 후보 중 가장 좁고 명료하다. 특정 host의 plugin API에 종속되지 않는 external runner 경계도 좋다.
- 단점: 사용자 표면은 네 workflow로 좁지만 구현은 TypeScript, Rust, Python, native bindings를 포함한 큰 모노레포다. Bun·native binary·tmux까지 포함하므로 배포물 자체를 경량이라고 보기는 어렵다.

### 명칭 혼선

- 코딩 하네스 문맥에서는 `Gajae-Code`로 식별되지만 `GJC` 단독 약어는 일반 검색 노이즈가 크다. npm과 문서에서는 `gajae-code`를 함께 쓰는 편이 안전하다. [npm package](https://www.npmjs.com/package/gajae-code)

## LazyCodex

### 사실

- LazyCodex는 독립 엔진이라기보다 OMO의 Codex Light를 한 줄로 설치하는 배포 레이어다. `npx lazycodex-ai install`은 OMO installer의 Codex target으로 연결된다. [Install 설명](https://github.com/code-yeongyu/lazycodex#-install)
- `$init-deep`, `$ulw-plan`, `$start-work`, `$ulw-loop`, skills, hooks, MCP, model routing, Codex agent roles와 doctor를 설치한다. [Built-in workflows](https://github.com/code-yeongyu/lazycodex#use-the-built-in-workflows)
- core source는 `code-yeongyu/oh-my-openagent`를 `src/` 아래 Git submodule로 포함한다. [`.gitmodules`](https://github.com/code-yeongyu/lazycodex/blob/main/.gitmodules), [Architecture](https://github.com/code-yeongyu/lazycodex#%EF%B8%8F-architecture)
- LazyCodex wrapper 저장소는 MIT다. [LICENSE](https://github.com/code-yeongyu/lazycodex/blob/main/LICENSE)
- 설치된 Codex marketplace/plugin 이름은 `omo@sisyphuslabs`다. [Marketplace install](https://github.com/code-yeongyu/lazycodex#install-from-the-codex-marketplace-experimental)

### 추론

- 장점: 사용자가 OMO 전체 설정을 이해하지 않아도 한 줄 설치와 doctor로 Codex Light를 도입할 수 있어 배포 UX가 단순하다.
- 단점: 별도 기술 축이라기보다 OMO distribution alias에 가깝고, LazyCodex·OMO·`omo@sisyphuslabs`라는 세 이름이 사용자에게 동시에 보인다.
- 라이선스 유의점: wrapper의 MIT는 OMO submodule의 SUL-1.0을 덮지 않는다. 새 상업용 하네스가 LazyCodex 구조를 참고하더라도 OMO core 코드를 복제·재배포할 때는 [OMO의 SUL](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/LICENSE.md)을 별도로 따라야 한다.

## 계보와 중복

### 사실

```text
OMO (Oh My OpenAgent)
└── Codex Light installer/core
    └── LazyCodex: 설치·문서·marketplace 배포 레이어

OMP (Oh My Pi)
└── implementation DNA
    └── GJC: external runner + 좁은 workflow surface

OMC (Claude Code host) ─┐
                        ├── deep-interview / ralplan / team 계열 workflow 실험
OMX (Codex host) ───────┘
                        └── GJC와 LazyCodex가 일부 개념을 명시적으로 참고
```

- OMO와 LazyCodex는 경쟁하는 두 독립 엔진이 아니다. LazyCodex가 OMO Codex Light를 포장한다는 사실은 양쪽 README와 submodule 선언에서 확인된다. [OMO edition 설명](https://github.com/code-yeongyu/oh-my-openagent#installation), [LazyCodex Architecture](https://github.com/code-yeongyu/lazycodex#%EF%B8%8F-architecture)
- GJC는 OMP 구현 계보와 OMC/OMX workflow 학습을 NOTICE에서 명시한다. [GJC NOTICE](https://github.com/Yeachan-Heo/gajae-code/blob/main/NOTICE.md)

### 추론

- 여섯 이름은 기능적으로 완전히 독립된 여섯 아이디어가 아니다. `전문 agent + 단계형 plan/execute/verify + durable loop + team + model routing`이 반복되고, 차이는 주로 호스트, 배포 방식, 기본 기능의 폭, 상태 저장 방식에 있다.
- 새 경량 하네스의 차별점은 기능 수 경쟁보다 다음 네 가지에서 나오는 편이 낫다.
  1. 한 세션에서 하나뿐인 loop/state 권위
  2. 읽기·분석·구현·검수 단계별 명시적 모델/노력도 정책
  3. 재시작 가능한 최소 evidence ledger
  4. 설치·제거·doctor가 같은 경계를 공유하는 얇은 배포물
- 코드 출발점은 MIT인 OMP/GJC/OMC가 OMO보다 법적으로 다루기 쉽지만, 이들을 그대로 fork하면 다시 대형 모노레포가 된다. 경량성을 목표로 한다면 동작 계약과 workflow 아이디어만 추출해 독립 구현하는 편이 더 일관적이다.

## 조사 한계

Rein이 각 프로젝트에서 무엇을 채택하고 제외했는지, 현재 Codex CLI·
Grok·Claude·Gemini·Codex 앱·ChatGPT 앱을 어디까지 지원하는지는
[`lineage-and-portability.md`](./lineage-and-portability.md)의 명시적 선택표와
지원표에 정리했다. 이 문서의 사실 조사는 그 선택표의 근거이고, 선택표의
“채택”은 코드 복제가 아니라 clean-room 설계 패턴 구현을 뜻한다.

- 공개 GitHub와 공식 문서만으로 한국 커뮤니티의 실제 설치 수, 유료 사용자, 성공률, 장기 유지율은 검증할 수 없다.
- 빠르게 움직이는 프로젝트들이므로 모델명, agent 수, hook 수, 플랫폼 지원, 라이선스 파일 상태는 릴리스 전에 다시 확인해야 한다.
- 이 문서는 제품 비교 및 기술 조사이며 법률 자문이 아니다. 특히 SUL 코드의 상업적 사용·배포는 실제 출시 전에 라이선스 전문가의 확인이 필요하다.
