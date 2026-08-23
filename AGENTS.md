# Desktop/Laptop Work Handoff

This repository is maintained alternately from a desktop and a laptop. When the user uses one of the Korean trigger phrases below, treat it as an explicit request to perform the complete workflow. Do not ask the user to type Git or npm commands manually when Codex can run them.

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
3. Before staging, verify that `.env.local`, `data/archive-preview.sqlite`, credentials, tokens, generated build folders, and other private/local artifacts are ignored and absent from the commit. Never reveal their values.
4. Stage the intended project changes. Create a concise Korean commit message based on the actual changes; do not use the literal placeholder `작업 내용`.
5. Push `feature/desktop-laptop-workspace` to its normal remote without force.
6. Verify that the remote contains the new commit and leave the worktree clean. If there are no changes, do not create an empty commit; simply confirm the branch is synchronized.
7. Never deploy, merge into an operating/production branch, modify production Turso data, or upload the private SQLite database as part of this workflow.

## Missing tools

If Git or Node.js is missing, diagnose it first. Installation of required software may need the user's system approval; request that approval through Codex and perform the installation yourself when authorized. Do not send the user a list of commands as the default solution.
