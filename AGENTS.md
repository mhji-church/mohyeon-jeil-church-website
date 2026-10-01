# Desktop/Laptop Work Handoff

This repository is maintained alternately from a desktop and a laptop. When the user uses one of the Korean trigger phrases below, treat it as an explicit request to perform the complete workflow. Do not ask the user to type Git or npm commands manually when Codex can run them.

## Deployment and local-preview policy

These rules take precedence over the handoff steps below.

1. Until the user explicitly says `배포해줘`, do not create a PR or trigger any Netlify production, preview, or manual deployment. The only commit-and-push exception is the `이 컴퓨터에서 작업 종료` handoff workflow below, which updates the shared work branch only.
2. Accumulate completed changes in the local working tree and preserve all existing uncommitted work.
3. After each local change, reuse the existing project development server when possible. Prefer `http://localhost:3000`, verify that it responds, keep it running, and report the exact current URL and page path for review.
4. Do not start a duplicate project server. If port 3000 is occupied, identify the owning process without stopping unrelated processes and clearly report the full fallback URL.
5. Local tests, browser checks, and Netlify production-preset builds are allowed. Do not change production DB, R2, members, posts, permissions, secrets, or environment variables without separate approval.
6. Each completion report must include changed files, validation results, uncommitted Git status, and the current working local-preview URL.
7. When the user explicitly says `배포해줘`, review all accumulated changes, run the full test and build suite once, then update the production and shared branches with an atomic fast-forward push so that exactly one automatic Netlify production deployment runs. Do not create preview or manual deployments unless separately requested.

## `이 컴퓨터에서 작업 시작`

1. Confirm that the current directory is this repository and inspect `git status`, the current branch, remotes, and available Git/Node/npm commands.
2. The shared work branch is `feature/desktop-laptop-workspace`. Fetch the remote and switch to that branch. If local work or divergence makes switching/pulling unsafe, stop and explain the exact conflict without discarding anything.
3. Pull with fast-forward only. Never reset, force-pull, overwrite, or delete local changes.
4. Confirm `.env.local` and `data/archive-preview.sqlite` remain untracked/ignored and never print their values or contents.
5. Install dependencies only when missing or when the lockfile changed. On Windows PowerShell, prefer `npm.cmd` to avoid execution-policy failures.
6. Start the local development server and confirm that `http://localhost:3000/` responds. Keep the server running and report the URL.
7. This workflow does not authorize deployment, production database writes, PR merging, or changes to production environment variables.

## `이 컴퓨터에서 작업 종료`

1. Stop only the local development server associated with this repository.
2. Inspect `git status`, branch, and diff. Run `git diff --check` and an appropriately scoped test/build check when feasible.
3. Before staging, confirm that `.env.local`, `data/archive-preview.sqlite`, credentials, tokens, generated build folders, and other private/local artifacts are ignored and absent from the commit. Never reveal their values.
4. Stage only the intended project changes and create a concise commit describing the actual work. Do not create an empty commit when there are no changes.
5. Fetch the remote again and update only `feature/desktop-laptop-workspace` with a normal fast-forward push. Never force-push, rebase automatically, overwrite, or discard local or remote work. Stop and report if fast-forward is not possible.
6. Verify that the shared remote branch contains the new commit and leave the worktree clean. This makes the work available when another computer runs `이 컴퓨터에서 작업 시작`.
7. Do not update `agent/netlify-deployment`, create a PR, or trigger Netlify production, preview, or manual deployment as part of this handoff workflow. Production deployment still requires an explicit `배포해줘` request.
8. Never modify production Turso data, R2, members, posts, permissions, secrets, environment variables, or upload the private SQLite database as part of this workflow.

## Missing tools

If Git or Node.js is missing, diagnose it first. Installation of required software may need the user's system approval; request that approval through Codex and perform the installation yourself when authorized. Do not send the user a list of commands as the default solution.
