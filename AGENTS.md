# Repository Guidelines

## Project Structure & Module Organization

This checkout contains only documentation: `README.md` names the project, `Plan.md` defines the target architecture, and `Truth.md` tracks gaps and acceptance gates. There is no source, test suite, or asset directory yet. As implementation lands, place n8n exports in `n8n/workflows/`, migrations in `db/`, and setup guidance in `docs/`. Keep export filenames aligned with the inventory in `Plan.md`.

## Build, Test, and Development Commands

No build, test, or local-run command is defined yet. For documentation changes, run `git diff --check` for whitespace and `git status --short` to confirm changed files. When workflows arrive, import them into n8n, rebind credentials, and run their documented fixtures and smoke checks. An exported JSON file does not prove a live run succeeded.

## Coding Style & Naming Conventions

Use concise Markdown headings and relative links. Keep business logic in n8n workflows; `Plan.md` allows short JavaScript Code nodes and SQL. Name exports with two digits and snake_case, such as `05_requirement_matching.json`. Preserve the shared sub-workflow envelope and stable IDs in `Plan.md`. No formatter or linter is configured; follow each file's existing style.

## Testing Guidelines

There is no testing framework or coverage threshold yet. Add passing and failing fixtures for each workflow, including invalid input, duplicate requests, missing evidence, and retries where relevant. Test migrations against fresh and existing-schema databases. Record live n8n evidence for connectivity, retrieval, and PPTX/PDF gates before marking them complete.

## Commit & Pull Request Guidelines

Git history has one descriptive, imperative-style commit: `Add OliveSoft project plan and review`. Use similarly specific subjects. `Plan.md` calls for PRs from personal branches into `dev`, then reviewed releases into `main`. PRs should link the task or issue, describe contract changes, list validation, and include import details or artifact screenshots when relevant. Follow the plan's review rotation and lead review.

## Security & Configuration

Keep credentials in n8n credentials or environment configuration, never in exported workflows or fixtures. Document required credential names and rebinding steps without committing secrets. Protect webhook actions and artifact downloads with authentication, and use migrations instead of resetting shared database volumes.
