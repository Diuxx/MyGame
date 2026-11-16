# Whitebox inn — reusable prefabs

The prototype inn is a new **32 × 32 unit** map, deliberately independent of the default Playground. Its geometry is white / light gray only. No GLB, texture file, lightmap, or new tile is used by the inn.

## Open the map

```bash
cd code
npm ci
npm run dev-playground
```

Open **Maps 3D modulaires → Prototype — Auberge blanche → Charger / remplacer**.

For direct gameplay testing: `npm run dev-gameplay`, then open `?map=prototype-inn` (the normal start stays on `dojo`).

The ground floor is walkable. Stairs and mezzanines are **decorative and blocked**: a real vertical movement system is out of scope. Perimeter walls in front of the camera are deliberately low to preserve visibility.

## Edit and reuse

Enable **Éditeur de monde**. Use the **arrow keys** to pan the camera relative to its current orientation while editing; camera focus stays within map bounds. The hero remains stationary and disabling the editor instantly recenters the camera on the hero. Arrow keys are ignored for editor panning when a form control is focused. The **Blocs réutilisables (whitebox)** catalogue lists all available blocks. Click one, then click the floor to place it. Select an existing block to drag it or change its position, rotation, and scale. **Dupliquer ce bloc** creates an independent placement with shared geometry; **Supprimer ce bloc** removes that instance. Export the map JSON to keep the new layout.

Placements are records under `prefabs` in `code/public/assets/maps/prototype-inn.json`:

```json
{
  "id": "table-01",
  "prefab": "table-round",
  "position": [0, 0, 4],
  "rotationY": 90,
  "scale": 1
}
```

Definitions live in `code/public/assets/definitions/blockout-prefabs.json`. Each prefab defines a unique `name`, `category`, list of `parts` (box, cylinder, sphere), and an independent list of flat `colliders` (box or cylinder). Coordinates are local to the prefab origin. Rotation is in degrees around Y. Scale is uniform (0.25–4).

The catalogue loads only for maps declaring a `prefabs` field. To reuse a block in another map, add a placement referencing its ID; the map loader will validate and fetch the same catalogue. Changing a definition updates all placements **when the map is next loaded**. Altering an instance's position, rotation or scale leaves every other instance unchanged.

## Architecture and lifecycle

- `prefabDefinitions.ts`: typed definitions, strict JSON parsing and reusable transform math.
- `prefabRenderer.ts`: three shared unit meshes per map (only the kinds used), one white material, Babylon mesh instances and debug colliders; explicit disposal.
- `dataLoader.ts` / `validation.ts`: load and validate prefab catalogue and placements before constructing the scene.
- `mapCollision.ts` / `navigationData.ts`: transform each authored collider with the placement's rotation, scale and position.
- `mapBuilder.ts` / `mapSystem.ts`: place/remove/update prefabs and rebuild collision/nav metadata after edits.
- `playground/worldEditor.ts`: reuse the existing editor interface; no new editor runtime.

### Technical limits

- No physical climbing, multiple navigable floors, or navmesh.
- Colliders are approximate simple primitives, not triangle meshes.
- The source geometry and materials are shared per loaded map, rather than globally across unloaded maps. On map disposal, all source meshes and instances are freed.
- Browser rendering, shadow quality and mobile performance require interactive visual verification.

Reference documents `AGENTS.md`, `docs/PROJECT.md` and `docs/PROJETCT.md` remain unchanged.
