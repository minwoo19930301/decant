---
name: decant-release
description: Prove that an authorized release or handoff is reproducible, traceable, and honestly described. Use for packaging, GitHub delivery, artifact reports, or launch preparation; do not publish without explicit authorization.
---

# Decant Release

Make release claims match checked artifacts and current support boundaries.

## Preflight gates

1. Confirm version, target commit, remote, branch, tag policy, and publication authority.
2. Run the project test, lint, build, package, and doctor commands that apply.
3. Test the install or package from a clean location when practical.
4. Record artifact paths, sizes, and cryptographic hashes.
5. Verify docs, examples, licenses, provenance, and unsupported-path labels.
6. Inspect the final diff and repository status.

For HTML reports, run deterministic structure checks first and semantic Reader-10 after the final bytes are generated. Bind the semantic result to the report hash; any report edit invalidates the old result.

## Publication boundary

Committing does not imply permission to push. Pushing does not imply permission to tag, create a release, deploy, or message users. Perform only the external actions the user requested.

Never move an existing release tag to include later work. Publish a new version only when explicitly requested and release gates pass.

## Handoff contract

Report:

- exact commit and version;
- commands executed and exit status;
- artifact hashes and locations;
- supported, experimental, and unsupported surfaces;
- release notes and upgrade instructions;
- remaining owner actions.

Promotion copy must use measured results and reproducible examples. Do not imply benchmark superiority before a published comparison exists.
