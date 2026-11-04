# 09: Retire the script autopilot

**What to build:** with the factory proven on Ody-drive, remove the script autopilot and every mention of it, so there is one factory.

**Blocked by:** 08

**Status:** closed

**Door:** one-way (removes a shipped skill)

- [x] The autopilot skill, its scheduler templates, scripts and tests are gone, and nothing outside the ADRs and closed specs mentions it.
  Verify: search the repository for "autopilot" outside `docs/adr/` and `.scratch/autopilot*`; nothing remains; `npm run validate` and `npm test` pass.
- [x] AGENTS.md, PLATFORMS.md, README, ROLES.md, UPSTREAM.md and GLOSSARY describe the factory and its vocabulary only.
  Verify: read them.
- [x] Setting up a project no longer seeds the autopilot configuration and points to the factory's setup instead.
  Verify: read `setup-software-context`; run it on a sandbox repository; no autopilot file appears.
- [x] `to-spec`, `to-tickets`, the tracker and merge-policy documents, and the implementer and verifier agents name the factory where they named autopilot.
  Verify: read them.
- [x] Plugin versions are bumped consistently across manifests and the Oh My Pi catalog.
  Verify: `npm run validate` passes.

## Handoff

**Delivered:** the autopilot skill (35 files: scripts, tests, scheduler templates) and `setup-software-context/autopilot.md` are removed; no file outside `docs/adr/` and `.scratch/` mentions autopilot. AGENTS.md, PLATFORMS.md (Running the factory), README, ROLES.md, UPSTREAM.md and GLOSSARY.md describe the factory; setup-software-context, the tracker and merge-policy templates, to-spec, to-tickets, setup-verification and the agents name the factory. software 0.7.0; `npm run validate` and `npm test` pass.
**Deviations from spec:** done before ticket 08, because the factory had proven itself on three sandbox specs and the Ody run depends on model quota, not on the old code.
**Gotchas:** `docs/agents/factory.md` is written by the factory skill's `setup`, not seeded by setup-software-context, which now points there as the next step.
