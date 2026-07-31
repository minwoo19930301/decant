# Third-party pattern notices

Rein's plugin and skill text are original clean-room work released under the repository's MIT license. No third-party prompt, script, asset, or implementation file was copied into this pack.

The Skill-ecosystem sources recorded in `provenance/sources.json`, together
with the broader agent and workflow lineage in `../../docs/prior-art.md`,
informed behavior-level patterns such as progressive disclosure,
specification before high-risk changes, root-cause debugging, independent
review, and verification before release. Repository and file-level licenses
still govern any future direct reuse.

In particular:

- Anthropic's `docx`, `pdf`, `pptx`, and `xlsx` skill directories have restrictive source-available terms and were not copied.
- OpenAI Plugins and Vercel Agent Skills require per-plugin or per-skill license checks; no repository-wide license was assumed.
- Claude Code is distributed under commercial terms, and Claude Squad is AGPL-3.0; their code was not incorporated.
- Ouroboros is MIT licensed. Rein independently implements only a bounded
  clarification and confirmation pattern; no Ouroboros code, prompt text,
  schema, Seed format, or asset is included.
- `openai/skills` is deprecated and is retained only as historical evidence. Current Codex packaging follows `openai/plugins` and official Codex documentation; current Claude Code packaging follows the official Claude Code plugin and marketplace documentation. Neither manifest copies third-party text.

When direct code reuse is proposed later, record the exact file, commit, license, modifications, and required attribution before merging it.
