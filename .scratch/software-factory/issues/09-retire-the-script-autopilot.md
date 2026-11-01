# 09: Retire the script autopilot

**What to build:** with the factory proven on Ody-drive, remove the script autopilot and every mention of it, so there is one factory.

**Blocked by:** 08

**Status:** ready-for-agent

**Door:** one-way (removes a shipped skill)

- [ ] The autopilot skill, its scheduler templates, scripts and tests are gone, and nothing outside the ADRs and closed specs mentions it.
  Verify: search the repository for "autopilot" outside `docs/adr/` and `.scratch/autopilot*`; nothing remains; `npm run validate` and `npm test` pass.
- [ ] AGENTS.md, PLATFORMS.md, README, ROLES.md, UPSTREAM.md and GLOSSARY describe the factory and its vocabulary only.
  Verify: read them.
- [ ] Setting up a project no longer seeds the autopilot configuration and points to the factory's setup instead.
  Verify: read `setup-software-context`; run it on a sandbox repository; no autopilot file appears.
- [ ] `to-spec`, `to-tickets`, the tracker and merge-policy documents, and the implementer and verifier agents name the factory where they named autopilot.
  Verify: read them.
- [ ] Plugin versions are bumped consistently across manifests and the Oh My Pi catalog.
  Verify: `npm run validate` passes.
