# Decant 설계 계보와 이식성

조사 기준일: 2026-07-13

## 먼저 읽을 결론

현재 Decant의 고정 `v0.1.1` 릴리스는 **Relay10 이름으로
게시되었으며 Codex 실행기 전용**이다. 검증된 경로는 Codex CLI와 이
환경에서 발견된 OpenAI 모델이다.

- Grok을 **stage 공급자**로 직접 지원하지 않는다. Codex의 custom model
  provider와 xAI의 Responses API를 조합하는 실험 경로는 성립할 가능성이
  있지만, 파일 도구·검색·structured output·Reader-10까지 종단간 검증하지
  않았으므로 현재 릴리스에서 stage 지원으로 표시하지 않는다.
- 반대로 Grok Build/Grok CLI를 **Skill host**로 쓰는 경로는 2026-07-15에
  확인했다. `.agents/skills` symlink로 여덟 개 skill이 로드되며, 이는
  host 지침일 뿐 stage 실행을 Grok으로 바꾸지 않는다.
- Claude와 Gemini API 직접 연결은 지원하지 않는다. 이는 stage 실행기
  이야기다. Skill/Plugin preview는 Claude Code가 Decant 스킬을
  로드하고 `decant` 또는 레거시 `decant` CLI를 부르는 표면을
  제공하지만, stage 실행은 여전히 Codex CLI subprocess다.
- 한 실행에서 scout는 Grok, architect는 OpenAI, maker는 Claude처럼
  공급자를 섞는 기능도 없다.
- Codex 데스크톱 task에서 shell로 `decant`(또는 레거시 `decant`)을
  부를 수는 있지만 이는 앱
  네이티브 통합이 아니라 별도 Codex CLI subprocess를 다시 실행하는
  간접 사용이다.
- Codex Plugin·Skill·MCP, ChatGPT Apps SDK, 독립 GUI는 가능한 다음
  배포 표면이지만 v0.1.1에는 구현돼 있지 않다. main에는 Codex와
  Claude Code 두 host용 Skill pack·plugin manifest preview가 있고,
  MCP·custom UI는 여전히 없다.

이 문서에서 **채택**은 비교 프로젝트의 코드를 가져왔다는 뜻이 아니다.
Decant은 비교 대상 소스 코드를 포함하지 않는 clean-room MIT 구현이며,
공개 문서에서 확인한 workflow 패턴만 독립적으로 구현했다.

## 국내 여섯 하네스: 장점, 단점, 채택, 제외

| 프로젝트 | 장점 | 단점 | Decant이 채택한 설계 | 의도적으로 제외한 무게 |
|---|---|---|---|---|
| [OMO · Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) | 전문 역할, 역할별 모델, 검색·편집·검증·Team·복구를 한 제품에 담은 배터리 포함형이다. | Ultimate와 Codex Light의 범위가 다르고, 11 agent·54+ hook·MCP·장기 loop가 상태 소유권과 진단 표면을 키운다. telemetry와 [SUL](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/LICENSE.md) 조건도 따로 확인해야 한다. | `scout → architect → maker → reviewer → explainer` 역할 분리와 역할별 모델·노력도. | OMO 코드, agent 군집, Team, background agent, hook·MCP·LSP·AST 묶음, telemetry, 멈추지 않는 loop. |
| [OMP · Oh My Pi](https://github.com/can1357/oh-my-pi) | 40개 이상 provider, 역할별 모델, TUI·SDK·RPC·ACP, hash-anchored edit, LSP·DAP를 갖춘 독립 runtime이다. | TypeScript·Rust·native addon·browser·debugger까지 유지하는 큰 제품이라 인증·보안·회귀 비용도 크다. | 읽기는 낮은 비용, 계획은 강한 모델처럼 역할에 따라 모델 등급을 바꾸고 model run을 process 경계에 두는 원칙. | 다중-provider runtime, TUI·SDK·RPC·ACP, native 도구, LSP·DAP, credential rotation, hash-anchored edit. Decant의 artifact hash는 편집 기능이 아니다. |
| [OMC · Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode) | `plan → PRD → exec → verify → fix` 단계와 전문 역할, 실패를 수정으로 되돌리는 QA loop가 명시적이다. | Claude host 안에 Team·tmux Team·Autopilot·Ralph·UltraQA 등 여러 loop와 실행 권위가 공존한다. | 계획·구현·검토 분리, 명령 검증과 model reviewer 분리, architect·reviewer read-only와 maker write 권한 분리. | 19 agent, native Team·tmux worker, 자동 병렬화·learned memory, 중첩 completion loop와 자동 fix 반복. |
| [OMX · Oh My Codex](https://github.com/Yeachan-Heo/oh-my-codex) | Codex 엔진을 유지하면서 durable goal, doctor, evidence, worktree 격리와 실제 model smoke test를 보강한다. | Codex CLI·tmux 중심이며 hook·skill·worktree·`.omx` 상태를 함께 배워야 한다. 공식 README도 Codex App 경로는 덜 지원될 수 있다고 경고한다. | `doctor`, 실행 전 route 미리보기, `.decant/runs/`의 inspectable evidence, artifact hash와 frozen replay. | `/goal` DSL, checkpoint·resume, worktree·tmux Team·HUD·hook, 여러 completion loop와 광범위 자율 권한. |
| [GJC · Gajae-Code](https://github.com/Yeachan-Heo/gajae-code) | host를 패치하지 않는 external harness이며 공개 workflow와 기본 역할 수가 비교적 좁고 명료하다. | 겉의 명령은 작지만 TUI·Rust·Python·tmux·RPC·Telegram·notebook·computer-use를 포함한 experimental beta다. | external wrapper 경계, 작은 CLI 명령 집합, maker만 쓰기 가능한 역할 권한, 근거 파일 보존. | 자체 TUI·native binary, tmux·worktree Team, RPC·Bridge·Telegram, RLM notebook, computer-use, 다중 runtime 묶음. |
| [LazyCodex](https://github.com/code-yeongyu/lazycodex) | OMO Codex Light를 한 줄 install·doctor·uninstall 흐름으로 포장해 초기 도입이 쉽다. | 독립 엔진이 아니라 OMO 배포 layer다. 세 이름, plugin cache·hook·config 변경, OMO SUL 조건이 같이 따라온다. | 짧은 quick start, 하나의 `decant` 진입점과 레거시 `decant` 호환, 설치 직후 `doctor`로 확인하는 UX. | Codex plugin 주입, 전역 config 자동 변경, marketplace·startup hook, OMO submodule과 SUL 코드. 한 줄 install·upgrade·uninstall은 Decant에도 아직 없다. |

OMO와 LazyCodex는 완전히 독립된 두 엔진이 아니다. LazyCodex는 OMO
Codex Light를 설치·문서·marketplace로 배포하는 layer다. GJC도
[NOTICE](https://github.com/Yeachan-Heo/gajae-code/blob/main/NOTICE.md)에서
OMP 구현 계보와 OMC·OMX workflow 실험의 영향을 밝힌다. 따라서 여섯
이름을 서로 무관한 여섯 발명처럼 세지 않았다.

## 해외에서 확인한 패턴

- [OpenDev](https://github.com/opendev-to/opendev)와
  [Continue](https://docs.continue.dev/customize/model-roles)는 실행·사고·압축·
  자기검토 또는 chat·autocomplete·edit·apply처럼 역할별 모델 slot을 둔다.
- [Aider Architect](https://aider.chat/2024/09/26/architect.html)는 해결 방향을
  만드는 모델과 실제 edit를 만드는 모델을 분리한다.
- [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent)는 기능 수보다
  이해 가능한 작은 core를 기준선으로 둔다.
- Claude Squad 같은 multi-CLI runner, OpenHands 같은 agent platform,
  workflow pack 계열은 서로 다른 제품군이다. 해외에서도 모두가 쓰는
  하나의 표준 harness가 확인된 것은 아니다.

Decant은 여기서 역할별 모델 slot, architect/editor 분리, 작은 core라는
세 패턴만 골랐다. 위험·파급 범위·검증 가능성·되돌림 가능성을 함께
평가하는 초기 router, correctness와 report clarity의 분리, hash-bound
frozen replay, economy/low 모델 열 번의 Reader-10은 Decant의 추가 설계다.

## 현재 공급자 지원표

| 대상 | v0.1.1 상태 | 판정 근거 | 지원에 필요한 것 |
|---|---|---|---|
| Codex CLI + 현재 OpenAI 모델 | **지원·검증됨** | 모든 model stage가 `codex exec`, catalog가 `codex debug models`, doctor가 `codex --version`을 사용한다. | 추가 작업 없음. Node 20+와 인증된 Codex CLI가 필요하다. |
| Codex + xAI/Grok custom provider (stage) | **실험 후보·미검증** | Codex custom provider와 xAI가 모두 Responses 표면을 제공한다. 그러나 Decant은 provider를 선택하거나 capability를 검사하지 않는다. | user-level Codex xAI profile, 모델 override, effort 정규화, file tool·search·schema·Reader-10 E2E 검증. |
| OpenAI Responses API 직접 | **미지원** | Decant은 HTTP API client가 아니라 Codex subprocess wrapper다. | catalog·executor adapter와 로컬 file/shell/search agent runtime. |
| Anthropic/Claude API 직접 | **미지원** | Anthropic의 공식 OpenAI SDK compatibility는 Chat Completions 표면이고 네이티브 API는 Messages다. | Anthropic native executor 또는 검증된 Responses 변환 proxy와 tool runtime. |
| Google Gemini API 직접 | **미지원** | Gemini의 OpenAI compatibility도 Chat Completions 표면이며 Decant에 Gemini catalog·executor가 없다. | Gemini native executor 또는 검증된 Responses 변환 proxy와 tool runtime. |
| 한 run의 공급자 혼합 | **미지원** | stage config에는 model만 있고 `providerId`, profile, capability negotiation이 없다. | stage별 provider, adapter registry, effort·tool·schema 사전 검증. |

공식 protocol 근거:

- [Codex custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference#configtoml)
- [xAI quickstart와 Responses API](https://docs.x.ai/developers/quickstart)
- [xAI reasoning effort](https://docs.x.ai/developers/model-capabilities/text/reasoning)
- [Anthropic OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)
- [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)

### OpenAI-compatible API만으로 부족한 이유

현재 Codex가 다음을 대신 책임진다.

1. workspace 파일 읽기와 쓰기;
2. shell command와 process 관리;
3. sandbox와 approval;
4. search와 tool-call loop;
5. JSON schema output과 모델 catalog.

base URL만 바꾸면 text endpoint는 연결될 수 있어도 이 코딩-agent runtime의
전체 행동이 같은지는 보장되지 않는다. Codex를 우회해 provider API를 직접
호출하려면 Decant이 이 runtime을 제공하거나, 공급자별 기존 agent host에
연결해야 한다.

## CLI가 아닌 앱 지원표

| 표면 | 현재 | 가능한 경로 | 중요한 제한 |
|---|---|---|---|
| Codex CLI | **지원** | 현재 `decant` binary | v0.1.1의 공식 표면. |
| Codex 데스크톱·IDE | **main Skill preview, 실행은 간접** | repo-scoped Skill 또는 앱 task의 shell 호출 | 내부 실행은 별도 Codex CLI다. 앱의 현재 task model을 단계별로 바꾸지 않는다. |
| Codex Skill | **main에 8개 구현·정적 검증** | `.agents/skills`가 Plugin의 canonical Skill pack을 가리킴 | Skill은 재사용 지침이지 강제 router나 전용 UI가 아니다. surface별 trigger forward eval은 아직 필요하다. |
| Codex Plugin | **main manifest·Skill bundle preview** | `plugins/decant/.codex-plugin/plugin.json` | marketplace에 게시하지 않았고 MCP·hook·custom UI가 없다. 고정 v0.1.1 tag에는 포함되지 않는다. |
| Claude Code Skill | **preview·2026-07-15 재검증** | `.claude/skills` symlink가 Plugin의 canonical Skill pack을 가리키고, repo 세션·plugin install 경로에서 8개 skill을 확인 | Skill은 재사용 지침이지 stage 실행이 아니다. `decant` model stage는 여전히 인증된 Codex CLI가 필요하다. |
| Claude Code Plugin + marketplace | **preview·`claude plugin validate` 통과·install details 확인** | `plugins/decant/.claude-plugin/plugin.json`과 루트 `.claude-plugin/marketplace.json` | curated marketplace에 게시하지 않았고 MCP·hook·custom UI가 없다. 고정 v0.1.1 tag에는 포함되지 않는다. |
| Grok Build / Grok CLI Skill host | **preview·2026-07-15 검증** | `.agents/skills` symlink와 live Grok 세션에서 8개 `decant-*` skill 로드 | Skill host만 해당. xAI/Grok stage executor·Reader-10 E2E는 미검증. |
| Codex Plugin + local MCP | **MCP 미구현** | `decant.route/run/status/inspect/report` 도구 | 앱 안의 native progress 경험은 만들 수 있지만 stage model execution은 Decant server가 맡아야 한다. |
| ChatGPT 앱·웹 | **미지원** | remote MCP + Apps SDK UI | ChatGPT 웹이 이 Mac의 local repo를 직접 실행하는 구조가 아니므로 remote worker 또는 안전한 sidecar가 필요하다. |
| 독립 Electron·Tauri·Swift GUI | **미구현** | provider-neutral local sidecar | path allowlist, 인증, 취소, concurrency lock, approval UI가 필요하다. |
| Codex 전용 custom GUI | **미구현** | Codex App Server | thread·turn·model·approval·event를 앱에 연결할 수 있지만 provider-neutral GUI와는 다른 경로다. |

공식 app 근거:

- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Build plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Codex와 ChatGPT의 MCP](https://learn.chatgpt.com/docs/extend/mcp)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Apps SDK quickstart](https://developers.openai.com/apps-sdk/quickstart)
- [MCP Apps와 Apps SDK의 관계](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt#how-this-relates-to-the-apps-sdk)

## 권장 분리 설계

다중 공급자와 앱을 동시에 풀려면 CLI에 조건문을 더하는 것보다 네 층으로
분리하는 편이 안전하다.

```text
workflow core
  -> provider/catalog adapter
  -> workspace-agent executor adapter
  -> common StageResult + artifact contract
  -> CLI / MCP / App Server / GUI surface adapter
```

최소 executor 계약은 다음 정도면 된다.

```js
{
  id,
  discoverModels(),
  capabilities(model),
  normalizeEffort(model, effort),
  execute({ prompt, model, effort, cwd, sandbox, search, outputSchema }),
  doctor()
}
```

## 출시 순서 제안

1. **v0.2 후보 — 앱 노출:** main의 Codex·Claude Code plugin manifest와 8 Skill은
   구현됐다. surface별 forward eval과 marketplace packaging 뒤 local stdio MCP로
   기존 CLI의 `route/run/status/inspect/report`를 노출한다.
2. **v0.3 — 공급자 분리:** `CatalogAdapter`, `ExecutorAdapter`, stage별
   `{ providerId, model, effort }`, capability negotiation을 추가한다. xAI/Grok
   E2E를 통과한 뒤에만 공식 지원으로 표시한다.
   공개된 Grok Build 소스 확인 결과(2026-07-17,
   [grokbuild-distillation.md](grokbuild-distillation.md)에 커밋 고정)로
   Grok adapter에는 세 가지 구조적 제약이 미리 확정됐다: (a) headless
   `grok -p`는 output-file side channel이 없고 `--output-format json`의
   stdout JSON 한 덩어리만 준다 — `readText(outputFile)` 계약을 stage 단위로
   바꿔야 한다; (b) prompt는 stdin이 아니라 `-p`, `--prompt-json`, 또는
   `--prompt-file` CLI argument로 선택된다; (c) Grok의 sandbox는 미지원
   플랫폼·적용 실패 시 경고만 남기고
   계속 진행하는 fail-open이라, Decant의 read-only stage 계약을
   "enforced"로 광고할 수 없다 — adapter capability에 `sandboxEnforced:
   false`로 기록해야 한다.
3. **v0.4 — GUI:** ChatGPT에는 Apps SDK + remote worker, local repository에는
   local sidecar GUI를 제공한다. Codex 전용 custom GUI는 App Server 경로와
   분리한다.

## 표현상 주의

- “Grok 지원”이라고 뭉뚱그리지 않는다. stage는 “Codex custom-provider 경유
  실험 후보, 미검증”이고, skill host는 “`.agents/skills` 로드 검증됨”이다.
- 호스트 검증 근거는 [`host-surface-verification.md`](./host-surface-verification.md)
  에 날짜와 명령 결과로 남긴다.
- “Codex 앱 native 지원”이 아니라 “repo Skill preview와 shell 간접 실행 가능,
  MCP·custom UI·현재 task model 전환 없음”이다.
- “10개의 가장 멍청한 모델”이 아니라 “economy 역할 모델을 low 노력으로
  열 번 호출”이다. catalog label은 실제 지능·가격 순위를 증명하지 않는다.
- “체리피킹”은 코드 복제가 아니라 공개된 동작 패턴의 clean-room 독립 구현이다.

이 문서는 기술 비교이며 법률 자문이 아니다. 특히 OMO SUL과 다른
프로젝트의 라이선스는 실제 코드 재사용이나 상업 배포 전에 다시 확인해야 한다.
