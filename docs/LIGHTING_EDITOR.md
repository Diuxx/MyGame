# Map Lighting — WorldLighting / MapLighting

This feature uses the map's `lighting` section as the only authored lighting source.
It does not add the future combat/skill `EffectLighting`.
For composition principles and a project-specific lighting checklist, see
[GAME_LIGHTING_THEORY.md](./GAME_LIGHTING_THEORY.md).

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

## Blockout lighting arena (`playground`)

`public/assets/maps/playground.json` is a **36 × 36 unit** enclosed lighting
test arena built from reusable geometry, not a textured or imported GLB level.
The Playground starts on `prototype-inn`; this arena remains only as an
internal map definition and is no longer available in the map selector.
The ground is a four-panel gray blockout platform, with a simple circular
center marker. Each of the four boundaries uses nine reusable wall sections,
with tall far-facing walls and shorter near-camera walls for visibility.
Four corner pillars frame the room.

The catalogue `public/assets/definitions/blockout-prefabs.json` includes
five reusable modules: `wall-dark`, `wall-dark-low`, `pillar-dark`,
`lamp-wall-blockout` and `lamp-center-blockout`. Their optional per-part
`color` and `emissive` values are validated and rendered through shared
instanced meshes and materials; prefabs without these fields remain white.
Sconces are decorative blockout meshes with **no extra colliders**.

The map's `lighting` contains five shadow-free point lights: one above the
center, one near each wall-mounted fixture. Global sunlight is off and a
subtle hemispheric fill remains, so warm light pools are clearly visible
without losing the outlines of distant walls. The two stationary wooden
targets can be used to test combat and lighting together.

The map is deliberately saved as editable data: walls, sconces and the
central fixture are `prefabs`; targets are `enemySpawns`, and all five
lights are `lighting.map.lights`. No generated gameplay behavior is bound
to a particular wall, lamp or target. To change the layout, edit the
placements or use the World Editor, then export the map.

### Blender fog-bank asset

The reusable localized fog asset is authored in
`code/assets/source/effects/fog-bank.blend` and exported as
`code/public/assets/models/effects/fog-bank.glb`. Its procedural RGBA
texture is embedded in the GLB; the glTF material uses alpha blending,
and the asset has no collider. The `playground` map places it beneath the
central light fixture as a legacy placement; the map is no longer part of
the manual map-selection flow.

## Editing in the Playground

1. Launch `cd code && npm run dev-playground`.
2. Load a map and choose **Monde → Éclairage** in the new workspace.
3. Set WorldLighting to off to test a cave, while keeping MapLighting on.
4. Add point, spot, directional, or hemispheric lights. Select a light to change
   its full parameter set. Numeric XYZ controls or **Placer à la position du héros**
   move it. Duplicate/delete as needed.
5. Select a placed object with an asset-defined local spotlight to edit its local
   position and direction, color, intensity, range, cone angle and exponent. These
   changes apply to that instance and are included in the exported map; new
   placements continue to use the asset defaults.
6. Toggle the map markers to preview positions and ranges while in editing mode.
   They are not part of the exported world and are hidden while testing the game.
7. Use the existing **Exporter map JSON** command (top toolbar) to save the
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
