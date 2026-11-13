# Project reference — Idle Action RPG

The [founding project reference](PROJETCT.md) defines the product vision, gameplay requirements, art direction, and technology choices. Read it together with the architecture guidelines below before changing the game. Both documents require explicit authorization for edits. Keep status updates, experiments, and backlogs in separate documents.

## Software Architecture & Development Guidelines

Organize the Vite application by feature under `code/src/`. Keep the rules, adapters, and tests for each responsibility close together so a developer can find and change a feature without tracing unrelated systems.

```text
code/src/
├── main.ts       # Application startup and mode selection
├── playground.ts # Playground entry point
├── style.css     # Application styles
├── character/    # Hero model, animation, input and movement
├── combat/       # Damage, regeneration and hit detection
├── enemies/      # Archetypes, instance state and scene representation
├── world/        # Camera, environment and scene setup
├── playground/   # Development and debugging tools
└── ui/           # Reusable interface utilities
```

- **Keep dependencies one way.** Entry points assemble features. The Playground may use gameplay modules and reusable UI. Gameplay modules must never import Playground tools. Avoid circular imports, including cycles that arise through shared types.
- **Keep rules independent of rendering and input.** Combat calculations use plain TypeScript state and geometry, without Babylon.js, the DOM, browser APIs, or enemy archetypes. Enemy state and scene adapters consume these rules. Manual controllers and future AI must use the same combat rules. Enemy AI should make decisions independently of those rules and submit actions through the same gameplay interfaces.
- **Keep configuration separate from state.** Define enemy archetypes in JSON and validate their values in TypeScript before use. Copy mutable defaults when creating an instance so changes to one instance leave the archetype and other instances intact.
- **Name files by responsibility.** Use descriptive names and the existing lower camel case convention for TypeScript modules. Keep `*.test.ts` files alongside the code they verify. Reserve the source root for application entry points and essential application resources.
- **Place each new feature in the module responsible for it.** Extend existing modules when appropriate. Add a directory only when it represents a distinct responsibility. Extract shared code when multiple callers have a real responsibility in common.
- **Refactor in focused steps.** Inspect callers, configuration and tests before moving or splitting code. Preserve behavior, asset paths and launch commands unless a change is requested. Update imports and test paths together, and run the tests, build and relevant mode checks.
- **Keep the design proportional.** Prefer explicit code and composition. Apply SOLID, KISS, DRY and YAGNI pragmatically. Introduce a framework, event bus or ECS only when a concrete requirement justifies it.

The directory tree describes responsibilities and may evolve as requirements change. Keep the boundaries coherent and update this reference through a separately authorized change when those responsibilities change.
