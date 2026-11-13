# AGENTS.md — Game Development Guidelines

This file defines **general engineering practices** for people and coding agents working on this game repository. It is intentionally independent of any engine, programming language, game genre, or current prototype.

## 1. Source of truth and document boundaries

- **Read [`docs/PROJETCT.md`](docs/PROJETCT.md) before designing or changing gameplay, art direction, or technical scope.** It contains the project's product vision, established decisions, and non-negotiable guidelines.
- Treat `docs/PROJETCT.md` as **immutable**. **Never modify, rename, move, overwrite, or auto-format it** as part of a coding or documentation task. A request to update another document does not authorize editing it.
- If a new request conflicts with the project reference, explain the conflict and propose a separate change request. Only the project owner can explicitly authorize a dedicated update to `docs/PROJETCT.md`.
- Keep implementation notes, technical decisions, experiments, backlogs, and status updates in **separate, editable documents**. Do not present a prototype assumption as an established requirement.
- Before making changes, inspect the actual repository, entry points, dependencies, scripts, and nearby conventions. **Existing working code is evidence of implementation, not permission to override the project reference.**

## 2. Maintainable architecture

- Prefer simple, readable, explicit code. Follow the existing project's conventions and structure.
- Give modules and functions focused responsibilities. Extract meaningful rules or complex conditions into well-named functions, but avoid gratuitous abstraction.
- Separate **game rules and simulation** from rendering, input handling, audio, networking, persistence, and platform-specific APIs.
- Drive equivalent actions through shared gameplay systems. For example, human, AI, and scripted controllers should issue intents to the same action validation and execution paths.
- Prefer composition over deep inheritance. Use design patterns only when they solve a concrete problem.
- Favor SOLID, KISS, DRY, and YAGNI pragmatically. Build the smallest coherent feature that can be tested.
- Keep dependencies visible, avoid global mutable state where possible, and define ownership and lifetime for resources.

## 3. Gameplay correctness and responsiveness

- Keep the simulation consistent across rendering frame rates: use delta time correctly and use a fixed timestep for systems that require it.
- Define units, coordinate systems, orientations, collision layers, animation states, and timing conventions explicitly.
- Make state transitions and action rules predictable: cooldowns, interruptions, invulnerability, targeting, damage, and recovery should have one authoritative implementation.
- Avoid input latency: prioritize immediate feedback, clear animation timing, and readable telegraphs.
- Treat human control, AI control, and automation as swappable *decision sources*, not separate rule sets.
- Make important logic deterministic when practical; use explicit random seeds when reproducing issues matters.
- Handle pause, focus loss, slow frames, scene reloads, and missing resources without corrupting state.

## 4. Assets, animation, and visual clarity

- Keep source assets separate from runtime-ready exports. Record origin, license, and transformation steps.
- Define a consistent asset pipeline: naming, scale, pivots, orientation, texture settings, animation naming, and export checks.
- Validate imported models for scale, normals, texture references, skeleton compatibility, animations, and unexpected root motion.
- Reuse rigs, materials, and effects sensibly; optimize only after confirming visual and gameplay needs.
- Prioritize readable silhouettes, enemies, hit areas, and effects over gratuitous visual complexity.
- Release graphics resources and event listeners when scenes or entities are disposed.

## 5. Performance and platform support

- Establish budgets appropriate to target devices: frame time, draw calls, triangles, texture memory, load size, and asset streaming.
- Measure performance on representative low-end devices; do not infer mobile behavior from a desktop browser.
- Prefer batching, instancing, level of detail, texture compression, and culling where they measurably help.
- Keep input adaptable to keyboard, mouse, controller, and touch when those platforms are in scope.
- Design interfaces for differing aspect ratios, safe areas, readable text sizes, and accessible controls.
- Avoid adding platform wrappers or platform-specific implementations before they are needed.

## 6. Reliability and security

- Validate external input, save data, asset manifests, and network messages where applicable.
- Fail clearly and recover where sensible; never silently swallow errors or invent a successful result.
- Do not commit credentials or secrets. Keep licenses and third-party asset terms visible.
- Version persisted data formats and provide migration paths when a save schema changes.
- Keep user data collection minimal and intentional.

## 7. Testing and delivery

- Add proportionate tests for pure game rules, geometry, movement, collision, cooldowns, progression, and AI decisions.
- Test interactions that cross subsystem boundaries, especially animation transitions, asset loading, and controller switching.
- For visual changes, inspect actual in-engine output when possible. For platform claims, test that platform.
- Before delivery, simplify the code, remove unused pieces, and check build scripts and documentation for accuracy.
- Report **which checks were actually executed**, their outcomes, and remaining limitations. Never claim a build, device test, or visual validation that was not run.
- Deliver changes in small, reviewable increments; describe important trade-offs and update only editable documentation.

## 8. Working agreement for agents

1. Read `docs/PROJETCT.md` and the repository's local instructions.
2. Identify the smallest change that satisfies the request.
3. Preserve established behavior unless a change is explicitly requested.
4. Implement with explicit errors, appropriate tests, and minimal dependencies.
5. Verify what the environment allows; disclose what remains unverified.
6. Summarize changed files and important decisions.
7. **Never modify `docs/PROJETCT.md` without a separate, explicit authorization from the project owner.**
