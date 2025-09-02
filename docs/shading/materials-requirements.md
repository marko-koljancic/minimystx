Got it. Here’s a clear, code-free spec and task brief for adding **sub-flow–only “Material” nodes** that take geometry in, apply a material, and output the same geometry with that material bound. I’ve split it into behavior rules, node definitions (with exposed parameters), UX, compute/engine notes, serialization, and tests.

# 1) Core behavior (applies to all Material nodes)

* **Scope:** These nodes are allowed only inside GeoNode sub-flows.
* **I/O:**

  * **Inputs:** `geometry` (required), optional `textures` (future: normal, roughness, metalness, etc. via texture-node inputs)
  * **Outputs:** `geometry` (same topology/attributes), with a material instance assigned.
* **Override vs default:** The scene’s global default `MeshStandardMaterial` remains as a fallback. If a geometry path goes through a Material node, that node’s material **replaces** the default for that path.
* **Per-path application:** Material nodes affect only the geometry data that flows through them (not siblings), enabling different materials per branch in the sub-flow.
* **Single render source rule:** Only geometry reaching the sub-flow’s active/visible output contributes to the parent GeoNode’s render. Materials on non-contributing branches do not affect the scene.
* **Live updates:** Parameter changes re-instantiate or update the material and trigger a minimal re-draw; geometry is not re-computed unless upstream geometry changed.
* **Resource management:** Reuse material instances when params are unchanged; dispose previous GPU resources on change; reuse textures where possible.

# 2) Node types and parameters (exposed controls)

## A) Standard Material (Three.js `MeshStandardMaterial`)

**Node name:** `StandardMaterial`
**Purpose:** Physically-based but lean, good default for most surfaces.

**Exposed parameters**

* **Base**

  * `color` (RGB/hex) – default `#cccccc`
  * `opacity` (0–1) + `transparent` (bool; default false)
  * `side` (Front/Back/Double) – default Front
  * `wireframe` (bool; default false)
* **PBR surface**

  * `metalness` (0–1; default 0.0)
  * `roughness` (0–1; default 0.5)
* **Lighting**

  * `emissive` (RGB/hex; default `#000000`)
  * `emissiveIntensity` (0–10; default 1.0)
* **Maps (optional inputs or pickers; may be hooked up later)**

  * `map` (base color)
  * `metalnessMap`
  * `roughnessMap`
  * `normalMap` (+ `normalScale` 2D)
  * `aoMap` (+ `aoMapIntensity`)
  * `emissiveMap`
  * `envMap` (read-only assignment for now; intensity per renderer or local `envMapIntensity`)
* **Shadows & render hints**

  * `receiveShadows` (bool; default true)
  * `castShadows` (bool; default true)
  * `depthWrite` (bool; default true), `depthTest` (bool; default true)

**Notes:** Keep parameter ranges clamped. For transparency: when `transparent=true`, ensure correct depth sorting and premultiplied alpha off by default.

## B) Physical Material (Three.js `MeshPhysicalMaterial`)

**Node name:** `PhysicalMaterial`
**Purpose:** Advanced PBR with clearcoat, sheen, transmission, IOR.

**Exposed parameters**

* **Base**

  * `color`, `opacity`, `transparent`, `side`, `wireframe` (same semantics as Standard)
* **Core PBR**

  * `metalness` (0–1)
  * `roughness` (0–1)
  * `ior` (1.0–2.333; default 1.5)
  * `specularIntensity` (0–1; default 1.0)
  * `specularColor` (RGB/hex; default `#ffffff`)
* **Clearcoat**

  * `clearcoat` (0–1)
  * `clearcoatRoughness` (0–1)
* **Sheen (cloth-like)**

  * `sheen` (0–1)
  * `sheenColor` (RGB/hex)
  * `sheenRoughness` (0–1)
* **Transmission (glass-like)**

  * `transmission` (0–1)
  * `thickness` (0–10; world units)
  * `attenuationColor` (RGB/hex)
  * `attenuationDistance` (0–∞; meters; 0=disabled)
* **Emissive**

  * `emissive`, `emissiveIntensity`
* **Maps (optional inputs/pickers)**

  * `map`, `metalnessMap`, `roughnessMap`, `normalMap` (+ `normalScale`), `aoMap`, `emissiveMap`
  * `clearcoatMap`, `clearcoatRoughnessMap`, `clearcoatNormalMap`
  * `sheenColorMap`, `sheenRoughnessMap`
  * `specularIntensityMap`, `specularColorMap`
  * `transmissionMap`, `thicknessMap`
  * `envMap`
* **Shadows & render hints**

  * `receiveShadows`, `castShadows`, `depthWrite`, `depthTest`

**Notes:** For transmission features to look correct, ensure renderer settings support transmissive materials (opaque pass vs transmission render order) and that the environment map is set.

# 3) Node UX (panel + in-canvas)

* **Visual identity:** Use the existing node style with a “Material” badge and a small chip showing type (`Standard` / `Physical`).
* **Parameter sections:** Base, PBR, Advanced (Clearcoat/Sheen/Transmission), Maps, Shadows. Collapsible accordions.
* **Live preview:** Small thumbnail swatch next to the node title updates with `color`, `metalness`, `roughness`, `clearcoat`, and `transmission` approximations (no heavy render—just a hint).
* **Validation:** Disable incompatible controls dynamically (e.g., hide clearcoat params on Standard). Gray out map intensity sliders if map not connected.
* **Tooltips:** Short, practical descriptions with expected ranges.
* **Defaults:** Pre-filled with safe values matching current global defaults so dropping the node yields no surprise.

# 4) Compute & engine integration

* **Execution order:** Material node executes after geometry is available; it wraps the geometry’s renderable data with a material handle. No topology change.
* **Material identity:**

  * Create or fetch a material instance from a **material cache** keyed by `(type + param hash + connected texture ids)`.
  * When a parameter changes, invalidate cache key and dispose the old instance if not referenced elsewhere.
* **Geometry/material binding:** Bound at the renderable object level (e.g., `mesh.material = matInstance`). If upstream produces multi-material meshes, allow “apply to all sub-materials” first; per-group editing can be future work.
* **Textures:** If texture inputs exist, use texture resource handles; ensure color-managed sampling for base color maps (sRGB) and linear for data maps (metalness/roughness/normal/ao).
* **Shadows:** Respect node flags and propagate to the mesh instance (`castShadow`, `receiveShadow`).
* **Color space & encoding:** Enforce renderer color management (linear pipeline, sRGB output). Convert UI color inputs to linear before assignment where required.

# 5) Graph rules & conflicts

* **Multiple material nodes in series:** The **last** material node in a chain wins (downstream override).
* **Branching:** Different branches can carry different material assignments into a Group node; the Group outputs a combined render list preserving per-branch materials.
* **Fallbacks:** If a Material node has invalid params or missing textures marked as required, fall back to a safe Standard material with a warning in the node header.

# 6) Serialization & import/export

* **Persist:** Node type, parameter values, map bindings (by asset id), and shadow flags.
* **Stable ids:** Include a `materialPresetId` when relevant (for future preset system).
* **Versioning:** Add a `schemaVersion` for material nodes to allow future param additions without breaking old scenes.

# 7) Performance notes

* Cache material instances aggressively; avoid re-creating on every small slider move (debounce apply).
* Reuse textures; don’t duplicate GPU uploads.
* Dispose old materials on cache eviction.
* Avoid triggering full geometry re-evaluation on pure material changes.

# 8) QA scenarios (no code; what to verify)

**StandardMaterial node**

* Defaults match global look until parameters change.
* Changing `color`, `metalness`, `roughness` updates render immediately.
* Toggling `transparent` and adjusting `opacity` behaves correctly (no z-fighting, depthWrite toggling respected).
* Normal map connection changes surface shading.
* `receiveShadows`/`castShadows` flags honored.

**PhysicalMaterial node**

* Clearcoat and sheen sliders visibly affect highlights.
* Transmission + thickness + IOR behave as expected with an environment map.
* Switching maps on/off updates without leaks or stale GPU state.

**Graph interactions**

* Two branches with different materials merged via Group preserve per-branch materials.
* Material node downstream overrides upstream material.
* Removing a Material node reverts geometry to global default material.

**Resource lifecycle**

* Rapid parameter scrubbing does not leak materials; material count remains bounded.
* Disconnected textures are disposed when no longer referenced.

# 9) Tasks for implementation (actionable, step-by-step)

1. **Node contracts**

* Define a common “MaterialNode” contract: inputs/outputs, param schema, validation hooks, material cache key function.
* Add two implementations: `StandardMaterial`, `PhysicalMaterial`.

2. **Parameter schema & UI**

* Create param schemas (types, ranges, defaults, visibility conditions).
* Build the property panel sections with live enable/disable logic.
* Add a compact preview swatch next to the node title.

3. **Texture inputs (extensible)**

* Support optional inputs for common maps (color, roughness, metalness, normal, ao, emissive, env).
* If a map input is connected, the corresponding UI field remains visible but read-only for source; expose intensity/scale controls where applicable.

4. **Material cache & lifecycle**

* Implement a cache keyed by `(nodeType + param hash + texture ids)`.
* On change: compare new key; if different, create new material, swap on renderable(s), dispose old if unreferenced.
* Implement reference counting or usage tracking per material instance.

5. **Binding to render objects**

* In the sub-flow execution, ensure the geometry’s renderable receives the cached material handle.
* Propagate `castShadow`/`receiveShadow`, `side`, depth flags.

6. **Renderer compatibility**

* Confirm renderer color management and encoding assumptions.
* Validate transparency and transmission ordering don’t break existing passes.

7. **Graph rules**

* Enforce “last material wins” on linear chains.
* Ensure Group node preserves materials for each child input.

8. **Serialization**

* Persist node type, params, map bindings, flags, schemaVersion.
* Ensure import properly re-creates material cache keys and references.

9. **Diagnostics**

* Node header warning state if required maps are missing (when marked required).
* Lightweight perf counters (material instance count) for debugging.

10. **QA & acceptance**

* Run the scenarios listed above with both materials, with and without maps, single and branched flows, and under rapid parameter changes.

# 10) Suggested next nodes (optional, for roadmap)

* **Texture Loader** (URL/file → texture handle with color space controls)
* **Material Switch** (N inputs, 1 output, switch by enum)
* **Mix Material** (lerp between two inputs by factor or mask)
* **MatCap Material** (fast stylized previews)
* **Toon Material** (non-photoreal look)

If you want, I can adapt this into a “Claude Code task” format you use for your repo (titles, acceptance criteria, panel copy, and file placement), without adding code.
