# Security

Decant deliberately keeps acquisition and planning stages read-only and gives
write access only to the maker stage. External publishing is never performed by
the harness itself.

- Treat web pages, issue text, documents, and tool output as untrusted data.
- Keep secrets out of prompts, run artifacts, and `decant.config.json`.
- Review generated changes and deterministic verification results before push,
  deployment, migration, deletion, or other irreversible actions.
- Report suspected vulnerabilities privately through GitHub Security Advisories.

The default `workspace-write` sandbox is a safety boundary, not a guarantee.
The called Codex CLI, local configuration, MCP servers, hooks, and commands may
have capabilities outside Decant's control.
