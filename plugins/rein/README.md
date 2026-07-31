# Rein Plugin

The plugin package id and Skill ids remain `rein` / `rein-*` in version
0.2 so existing host installations continue to resolve them. The npm package
and primary CLI are `rein`.

This preview bundles eight focused, on-demand skills:

- `rein-orchestrate`: choose the smallest safe workflow;
- `rein-research`: gather current read-only evidence;
- `rein-spec`: define an executable change specification;
- `rein-build`: implement an authorized change in small slices;
- `rein-debug`: isolate a root cause before repair;
- `rein-review`: review a fixed baseline without editing;
- `rein-release`: produce release and artifact proof;
- `rein-skill-lab`: test triggers and compare a skill with its baseline.

The pack follows the Agent Skills layout with two plugin manifests: `.codex-plugin/plugin.json` for Codex and `.claude-plugin/plugin.json` for Claude Code. It can guide work in Codex, Claude Code, or Grok Build and call an installed `rein` or legacy `rein` CLI, but it does not switch the model of the host's current task, add a provider, or provide a native app UI or MCP server. Rein model stages still launch Codex CLI subprocesses.

In Claude Code, install the pack from the repository marketplace:

```text
/plugin marketplace add minwoo19930301/rein
/plugin install rein@rein
```

A cloned repository also exposes the same skills directly: `.agents/skills` and `.claude/skills` are relative symlinks to the canonical pack at `skills/`. Grok Build discovers the pack through `.agents/skills` (and optional Claude-compat skill roots). The per-skill `agents/openai.yaml` files are Codex interface metadata; Claude Code and Grok ignore them and load each skill from its `SKILL.md`.

Host-surface verification notes (skill load only, not stage execution) live in `../../docs/host-surface-verification.md`.

All skill text and scripts are clean-room Rein work. `provenance/sources.json`
records the Skill-ecosystem source subset; `../../docs/prior-art.md` records the
complete lineage. See `THIRD_PARTY_NOTICES.md` for the licensing boundary.
