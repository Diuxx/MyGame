# Map Lighting — WorldLighting / MapLighting

This feature uses the map's `lighting` section as the only authored lighting source.
It does not add the future combat/skill `EffectLighting`.

## Design

- `world`: one existing Babylon.js sun and hemispheric light reused per scene.
  - `world.enabled = false` disables both for caves and indoor levels.
  - Each sun/ambient light also has its own `enabled` switch.
  - Sun direction, color, intensity, and shadow quality are configurable.
  - Hemispheric ambient color, ground color, and intensity are configurable.
- `map`: up to 32 independent point, spot, directional, and hemispheric lights.
  - Each has its own ID, enable switch, position, direction, color, intensity,
    range, cone angle, exponent, ground color, and optional shadow settings.
  - Only properties applicable to the selected light type affect rendering.
  - Hemispheric lights cannot cast shadows.
- `environment` retains only the existing **background and fog** responsibilities
  for new configurations. Its legacy sun/ambient fields are used as defaults when
  `lighting` is absent or omits them.
- No changes to hero skills, combat, or AI. No second world/editor state.

## Map JSON

The map schema remains `version: 1`. Missing `lighting` is legal; it is
derived from the existing `environment` settings and preserves existing maps.
Loading/exporting an old map materializes a complete lighting configuration.

To set up a dark cave:

```json
{
  "lighting": {
    "world": { "enabled": false },
    "map": {
      "enabled": true,
      "lights": [
        {
          "id": "cave-torch-1",
          "type": "point",
          "enabled": true,
          "position": [3, 2.5, 4],
          "color": "#FF983F",
          "intensity": 2,
          "range": 8,
          "shadows": { "enabled": false }
        }
      ]
    }
  }
}
```

This is the lighting **section**, not a standalone map document. Omitted
properties of a light get validated defaults. The parser rejects duplicate IDs,
invalid vectors/colors, infinite or out-of-range numeric values, unsupported
shadow resolutions, too many lights and shadows on hemispheric lights.

## Editing in the Playground

1. Launch `cd code && npm run dev-playground`.
2. Load a map and choose **Monde → Éclairage** in the new workspace.
3. Set WorldLighting to off to test a cave, while keeping MapLighting on.
4. Add point, spot, directional, or hemispheric lights. Select a light to change
   its full parameter set. Numeric XYZ controls or **Placer à la position du héros**
   move it. Duplicate/delete as needed.
5. Toggle the map markers to preview positions and ranges while in editing mode.
   They are not part of the exported world and are hidden while testing the game.
6. Use the existing **Exporter map JSON** command (top toolbar) to save the
   current `lighting` section to a file. Copy it into the versioned map asset.
   The editor's existing local draft mechanism also serializes these values.

## Runtime and performance

The scene owns one `createLightingController`; it reuses the established sun,
sky and shadow generator. On every map activation, previously created local
lights and their shadow generators are disposed and replaced. Map unloading
returns to the default lighting. Temporary editor markers are separately owned
by the Playground controller and disposed on map switches and shutdown.

Local shadows are **off by default**. Enabling them incurs additional shadow
rendering, particularly for point lights (cube faces). The local shadow maps use
the existing global caster list so hero/enemy/placed meshes are shared.
Babylon.js material light limits and mobile GPU budgets still apply; measure in
representative scenes before enabling many simultaneous shadow-casting lights.

The scene clear color and fog are controlled by `environment`, independently
of `world.enabled`. For fully dark caves, also review material emissive values,
PBR environment reflections, fog, and background color.

## Validation

`code/src/world/maps/lightingSettings.test.ts` covers backward compatibility,
disabled global lighting with enabled map lights, shadow configuration and
invalid user data. Run `npm test` and `npm run build` from `code/`.
Visual, performance and mobile validation must be performed in the engine.
