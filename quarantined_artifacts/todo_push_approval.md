# Push Approval & Verification TODO

- [x] Phase 1: Inspect repository status, branch, remote, exact diff, generated reports, tests, and source changes before staging anything
- [x] Phase 2: Remove or correct unsupported claims and exclude secrets, invalid addresses, generated private keys, and unsafe scripts from the commit
- [x] Phase 3: Run the complete local test, build, lint, dependency, and secret-scanning checks on the final staged diff
- [x] Phase 4: Commit and push only the reviewed verified changes to GitHub and report the exact commit hash and file list
- [x] Phase 5: Document post-push deployment status and clearly separate live-proven, configured, blocked, and unverified financial capabilities
