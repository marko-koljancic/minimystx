Minimystx — Overview

Minimystx is a web-based parametric modeling and design tool. It runs fully client-side (no logins, no backend) and is privacy-oriented by design. Scenes are built by connecting nodes into flows; nodes compute geometry, lighting, and utility features that render in a real-time Three.js viewport.



* Minimystx is a client-side, privacy-first, web-based parametric modeling tool.
* Vertical flow only: inputs on top, outputs on bottom, symmetric handle spacing.
* Contexts: Scene (Geo containers, Lights, Note) and Sub-flow (Primitives, Importers, Modifiers, Note).
* Geo holds a sub-flow and globally transforms its result.
* Lights are scene-only, handle-less, and toggleable; some expose shadow controls.
* Primitives/Importers output geometry (no inputs).
* Transform modifies upstream geometry (1 in, 1 out).
* Note documents flows in both contexts.

Graph & Flow Model

* Layout: Vertical only.
  * Inputs are always at the top of a node.
  * Outputs are always at the bottom of a node.
  * Handles are symmetrically distributed across node width.
* Contexts:
  * Root/Scene level: containers, lights, and utility nodes.
  * Sub-flow level (inside a Geo container): geometry creation, importers, and modifiers.
* Visibility: Only nodes that are visible contribute to the 3D scene.
* Shadows: Controlled at node level where applicable (containers and certain lights).

Node Catalog

Root/Scene Level

Containers

* Geo (container for a sub-flow)

Lights

* Ambient Light
* Directional Light
* Hemisphere Light
* Point Light
* Rect Area Light
* Spot Light

Lights exist only at the scene level. They have no input/output handles and cannot be connected to other nodes.

Utility

* Note (also available in sub-flows)

---

Sub-flow Level (inside a Geo)

3D Primitives

* Box
* Cone
* Cylinder
* Plane
* Sphere
* Torus
* Torus Knot

Primitives have one output (geometry) and no inputs.

Import

* Import glTF
* Import OBJ

Importers have one output (geometry) and no inputs.

Modifiers

* Transform
* Combine

Transform has one input (geometry) and one output (geometry).

---

Both Contexts (Scene & Sub-flow)

Utility

* Note

---

Node Specifications

Container

Geo Node Specification

Purpose

* Container role:
The Geo node acts as a container for geometry-building logic. It encapsulates a sub-flow of nodes (primitives, importers, modifiers, notes) and exposes the sub-flow’s result as a single unit in the scene.
* Organizational role:
Users can create multiple Geo nodes to separate modeling workflows (e.g., “Facade Geometry”, “Furniture”, “Context Massing”). Each Geo node is independent; deleting one removes its entire sub-flow.
* Transform anchor:
Unlike sub-flow modifiers, the Geo node applies global transforms (position, rotation, scale, scale factor) at the container level, meaning all geometry inside its sub-flow is affected together.
* Render anchor:
The Geo node manages whether its sub-flow result is visible, casts shadows, or receives shadows.

Behaviors

1. Sub-flow ownership
  * A Geo node can contain any number of primitives, importers, modifiers, and notes.
  * Sub-flows can be nested only one level deep (i.e., you can’t put a Geo node inside another Geo node).
2. Evaluation model
  * The Geo node has no input/output handles — it doesn’t connect like a modifier.
  * Instead, it evaluates its sub-flow DAG internally, and the computed geometry is injected into the Three.js scene.
  * Only one visible output node inside the sub-flow contributes to the final scene representation (users toggle visibility per node).
3. Transform application
  * Any transform set on the Geo node is applied after sub-flow evaluation, effectively wrapping the entire geometry group in a parent transform node.
  * Transforms on primitives/modifiers inside the sub-flow remain relative to their local chain, but the Geo node’s transform overrides globally.
4. Scene integration
  * Each Geo node registers its output as a scene object group (a Three.js Group).
  * Visibility toggles apply at the group level (hide all children).
  * Shadow flags apply recursively to all children (unless overridden later).
5. Lifecycle
  * Create: starts empty; user double-clicks to enter sub-flow editor.
  * Delete: removes sub-flow and all contained nodes from both UI graph and Three.js scene.
  * Rename/annotate: Name and description update metadata for the node and are displayed in UI.

Parameters

* General
  * Name: Editable text field (default: “Geo 1”, “Geo 2”, etc.).
  * Description: Read-only label — “Container for sub-flow geometry.”
* Transform
  * Position: Vector3; default (0, 0, 0)
  * Rotation: Vector3 (degrees); default (0, 0, 0)
  * Scale: Vector3; default (1, 1, 1)
  * Scale Factor: Number multiplier; default 1, range 0.0001–100
* Rendering
  * Render: Boolean; default On
  * Cast Shadow: Boolean; default On
  * Receive Shadow: Boolean; default On

Example Workflow

1. User creates Geo Node “Facade”.
2. Double-clicks to enter sub-flow.
3. Inside, places a Box primitive → Transform modifier (to resize it).
4. Marks the Box node as visible.
5. Back in the root scene, applies a Rotation (0, 90, 0) to the Geo node.
6. Result: the box geometry is rotated globally, while any transforms inside the sub-flow remain relative.

---

 The Geo node is essentially a scene-scoped, transformable container:

* Inside: procedural modeling (sub-flow).
* Outside: treated as a single object with its own transforms and visibility controls.

---

Lights (Scene-only)

Lights contribute to scene lighting while Visible is On. Toggling visibility updates the underlying Three.js light’s visible flag. All lights have no handles.

Great—here’s a consistent, implementation-ready spec for all Light nodes, mirroring the Geo format. I’ve kept it practical for both docs and engineering.

Lights — Common Specification

Purpose

* Provide physically intuitive illumination controls at the scene level.
* Each light is an independent scene contributor; lights are not part of Geo sub-flows.

Behaviors

1. Context & Handles
  * Scene-only. Lights cannot be created inside Geo sub-flows.
  * No input/output handles. They do not connect to other nodes.
2. Evaluation & Scene Integration
  * Creating a light instantiates the corresponding Three.js light and adds it to the scene.
  * Deleting the node removes the light from the scene.
  * Visible toggles the underlying light.visible.
  * If Cast Shadow is available and enabled, the light’s shadow map is created and updated per render.
3. Transforms
  * Position applies in world space.
  * Where applicable, Target defines orientation (Directional/Spot).
4. Helpers
  * When Show Helper is On, the corresponding helper object is created/updated and parented to the light (or its target, as appropriate). Turning it Off disposes the helper.
5. Performance Notes
  * Enabling shadows can be expensive. Prefer lower shadow map sizes during iteration.
  * Many lights with high intensities can cause over-bright scenes; use physically plausible ranges when possible.
6. Validation & Limits
  * Color accepts hex and RGB(A) pickers; alpha is ignored by Three.js lights.
  * Sliders should clamp to defined ranges; use 4–5 decimal precision where noted.
  * Map sizes are constrained to powers of two: 512, 1024, 2048.

---

Ambient Light

Three.js: THREE.AmbientLight

Purpose

Global uniform illumination that affects all objects equally; useful as a fill light.

Behaviors

* Directionless; Position is visual/organizational only (does not affect shading).
* No shadows.

Parameters

* General
  * Name (editable)
  * Description: “Uniform ambient illumination that affects all objects equally.” (read-only)
* Transform
  * Position: (0, 0, 0)
* Light
  * Color: white
  * Intensity: 0.5 (range 0–10, 5-digit precision)
* Rendering
  * Visible: On

---

Directional Light

Three.js: THREE.DirectionalLight

Purpose

Sun/sky-like light with parallel rays; good for outdoor scenes.

Behaviors

* Illuminates as if from infinite distance in the direction from Position toward Target.
* Supports shadows with orthographic shadow camera.
* Helper shows direction and frustum when enabled.

Parameters

* General
  * Name
  * Description: “Parallel light rays from a distant source; good for sun/sky.”
* Transform
  * Position: (10, 10, 5)
  * Target: (0, 0, 0)
* Light
  * Color: white
  * Intensity: 1.5 (0–10)
  * Cast Shadow: On (reveals Shadow)
* Shadow
  * Map Size: 2048 (512, 1024, 2048)
  * Bias: 0.0001 (−0.1 to 0.1, 5-digit precision)
  * Normal Bias: 0 (0–10)
  * Near: 0.1 (0.01–50)
  * Far: 50 (1–2000)
  * Left: −4 (−500–500)
  * Right: 4 (−500–500)
  * Top: 4 (−500–500)
  * Bottom: −4 (−500–500)
* Rendering
  * Visible: On
  * Show Helper: Off
  * Helper Size: 1 (0.1–10)

Implementation notes

* Keep a THREE.Object3D for the target; update direction when either Position or Target changes.
* Recompute shadow camera parameters on any Shadow control change; call light.shadow.camera.updateProjectionMatrix().

---

Hemisphere Light

Three.js: THREE.HemisphereLight

Purpose

Ambient-style light sampling different colors for sky and ground; quick outdoor fill.

Behaviors

* Non-directional gradient lighting from sky and ground colors.
* No shadows.

Parameters

* General
  * Name
  * Description: “Provides ambient illumination from sky and ground colors.”
* Transform
  * Position: (10, 10, 5) (visual only)
* Light
  * Sky Color: white
  * Ground Color: #444444
  * Intensity: 1 (0–10)
* Rendering
  * Visible: On
  * Show Helper: Off
  * Helper Size: 1 (0.1–10)

---

Point Light

Three.js: THREE.PointLight

Purpose

Omnidirectional point source; good for lamps and localized highlights.

Behaviors

* Attenuates with Distance and Decay.
* Supports shadows with perspective shadow map.
* Helper shows a sphere at the light position.

Parameters

* General
  * Name
  * Description: “Creates a point light source that emits light in all directions.”
* Transform
  * Position: (10, 10, 5)
* Light
  * Color: white
  * Intensity: 1.5 (0–10)
  * Distance: 0 (0–1000; 0 = no attenuation)
  * Decay: 2 (0–10)
  * Cast Shadow: On
* Shadow
  * Map Size: 1024 (512, 1024, 2048)
  * Bias: −0.0001 (−0.01 to 0.01)
  * Radius: 1 (0–25)
  * Near: 0.5 (0.01–100)
  * Far: 500 (1–2000)
* Rendering
  * Visible: On
  * Show Helper: Off
  * Helper Size: 1 (0.1–10)

Implementation notes

* Updating Distance or Decay requires re-lighting; ensure materials with physically correct lights are configured consistently.

---

Rect Area Light

Three.js: THREE.RectAreaLight
(Ensure the RectAreaLightUniformsLib is initialized in the renderer setup.)

Purpose

Rectangular emitter suitable for soft area lighting and product/architectural shots.

Behaviors

* Emits across a rectangular surface oriented by Position/Rotation.
* No shadows in core Three.js implementation (soft shadows are typically faked or require custom techniques).
* Helper draws the light panel and its extent.

Parameters

* General
  * Name
  * Description: “Rectangular area light for realistic lighting effects.”
* Transform
  * Position: (0, 0, 0)
  * Rotation: (0, 0, 0) degrees
  * Scale: (1, 1, 1)
  * Scale Factor: 1
* Light
  * Color: white
  * Intensity: 1.5 (0–10)
  * Width: 10 (0.1–1000)
  * Height: 10 (0.1–1000)
* Rendering
  * Visible: On
  * Show Helper: Off
  * Helper Size: 1 (0.1–10)

Implementation notes

* Call RectAreaLightUniformsLib.init() once during renderer initialization.
* RectAreaLight uses a special shader; ensure materials and tone mapping are set reasonably for expected brightness.

---

Spot Light

Three.js: THREE.SpotLight

Purpose

Cone-shaped light; useful for stage lighting, flashlights, focused accents.

Behaviors

* Direction is from Position toward Target.
* Supports shadows with perspective shadow camera.
* Helper shows cone and target when enabled.

Parameters

* General
  * Name
  * Description: “Cone-shaped light with distance, angle, and penumbra.”
* Transform
  * Position: (5, 10, 5)
  * Target: (0, 0, 0)
* Light
  * Color: white
  * Intensity: 1.5 (0–10)
  * Distance: 0 (0–1000; 0 = no attenuation)
  * Angle: 45 degrees (0–89 recommended; UI shows 0–89 to avoid grazing artifacts)
  * Penumbra: 0 (0–1)
  * Decay: 2 (0–10)
  * Cast Shadow: On
* Shadow
  * Map Size: 1024 (512, 1024, 2048)
  * Bias: −0.0001 (−0.1 to 0.1)
  * Normal Bias: 0 (0–10)
  * Near: 0.5 (0.01–50)
  * Far: 500 (1–2000)
* Rendering
  * Visible: On
  * Show Helper: Off
  * Helper Size: 1 (0.1–10)

Implementation notes

* Three.js SpotLight.angle is in radians; if UI uses degrees, convert on set/get.
* Update target object matrix when Target changes: light.target.position.set(...); light.target.updateMatrixWorld();

---

Cross-Node Conventions (for engineering)

* Naming: Auto-increment default names (e.g., “Directional Light 1”, “Directional Light 2”…).
* Units:
  * Angles in UI shown as degrees; convert to radians for Three.js properties.
  * Distances and sizes in scene units (meters by default, unless your Preferences specify otherwise).
* Shadow Toggles: Allocating shadows changes renderer state; dispose shadow maps on disable to free memory.
* Helpers: Create helpers lazily on Show Helper = On; dispose on Off to avoid leaks.
* Serialization:
  * Serialize all parameter fields, including Target vectors for directional/spot.
  * Serialize visibility and shadow toggles and the selected map size.

---

Example Workflows

1. Outdoor daylight
  * Add Directional Light (Position 50,80,30; Target 0,0,0; Intensity 2; Cast Shadow On; Map Size 2048).
  * Add Hemisphere Light (Sky white, Ground #808080, Intensity 0.3) for soft ambient fill.
2. Product studio setup
  * Add Rect Area Light above the object (Position 0,50,0; Rotation −90,0,0; Width 60; Height 30; Intensity 3).
  * Add two more Rect Area Lights as rim lights at lower intensities.
  * Optional: Add Ambient Light Intensity 0.1 for base fill.
3. Theatrical spotlight
  * Add Spot Light (Position 5,10,5; Target object center; Angle 35°, Penumbra 0.2; Intensity 2; Cast Shadow On).
  * Use Point Light with small Distance for accent highlights.

If you’d like, I can convert this into per-node Markdown files for your docs site (docs/nodes/lights/*.md) with front-matter (id, category, ports, defaults) and a shared partial for the “Common Specification”.

---

Utility

Note (Scene & Sub-flow)

Role: Visual annotation for documenting flows. Double-click to edit plain text; node is resizable; choose a predefined color.
Handles: None.

Parameters

* General
  * Name (editable)
  * Description: “Visual annotation for documentation” (read-only)

---

3D Primitives (Sub-flow)

All primitives output new geometry and have no inputs, one output.

Box

Description: “Creates a 3D box geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Width: default 1; range 0.001–100
  * Height: default 1; range 0.001–100
  * Depth: default 1; range 0.001–100
  * Width Segments: default 1; integer 1–512
  * Height Segments: default 1; integer 1–512
  * Depth Segments: default 1; integer 1–512
* Rendering
  * Visible: Boolean

Cone

Description: “Creates a 3D cone geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Transform (optional per-node if you expose it here; usually handled by a Transform modifier)
  * Position: default (0, 0, 0)
  * Rotation: default (0, 0, 0)
  * Scale: default (1, 1, 1)
  * Scale Factor: default 1; range 0.01–100
* Rendering
  * Visible: Boolean

Cylinder

Description: “Creates a 3D cylinder geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Top Radius: default 0.5; range 0.01–100
  * Bottom Radius: default 0.5; range 0.01–100
  * Height: default 1; range 0.01–100
  * Radial Segments: default 32; integer 3–512
  * Height Segments: default 1; integer 1–512
* Rendering
  * Visible: Boolean

Plane

Description: “Creates a plane geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Width: default 1; range 0.001–100
  * Height: default 1; range 0.001–100
  * Width Segments: default 1; integer 1–512
  * Height Segments: default 1; integer 1–512
* Rendering
  * Visible: Boolean

Sphere

Description: “Creates a 3D sphere geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Radius: default 0.5; range 0.001–100
  * Width Segments: default 32; integer 3–512
  * Height Segments: default 16; integer 2–512
* Rendering
  * Visible: Boolean

Torus

Description: “Creates a 3D torus geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Radius: default 0.5; range 0.001–100
  * Tube: default 0.2; range 0.001–100
  * Radial Segments: default 16; integer 3–512
  * Tubular Segments: default 32; integer 3–512
* Rendering
  * Visible: Boolean

Torus Knot

Description: “Creates a 3D torus knot geometry.”

Parameters

* General
  * Name (editable)
  * Description (read-only)
* Geometry
  * Radius: default 0.5; range 0.001–100
  * Tube: default 0.2; range 0.001–100
  * P: default 2; integer 1–10
  * Q: default 3; integer 1–10
  * Tubular Segments: default 128; integer 3–1024
  * Radial Segments: default 32; integer 3–512
* Rendering
  * Visible: Boolean

---

Import Nodes — Common Specification

Purpose

Load external 3D assets into a Geo sub-flow and expose them as geometry for downstream modifiers and rendering.

Behaviors

1. Context & Ports
  * Context: Sub-flow only (inside a Geo).
  * Ports: No inputs, one output (geometry or object group).
2. Evaluation & Scene Integration
  * Import is asynchronous. While loading, downstream nodes receive a “pending” state and should render nothing or a placeholder.
  * On success, the imported asset is attached under the sub-flow’s internal group; visibility follows node’s Visible toggle.
  * On failure, node enters “error” state with a readable message; output becomes null.
3. Source Files & Privacy
  * Files are chosen from the local machine via file picker; they are not uploaded to any server.
  * For multi-file formats, selection must include all referenced files (e.g., .gltf + .bin + textures, or .obj + .mtl + textures).
4. Transforms
  * Imported assets are emitted at their authored transforms.
  * The node offers Scale Factor; any additional transforms should be handled by a downstream Transform node.
  * Optional “Center to Origin” recenters the asset by bounding-box centroid to (0,0,0).
5. Materials
  * If Preserve Materials is enabled and the format contains materials, they are kept; otherwise a default scene material may be applied downstream.
  * Materials can later be overridden by material nodes (when you add them) or by applying modifiers that change materials.
6. Normals/Tangents
  * Loader will use embedded normals/tangents if present. If missing, recompute normals as part of post-load processing. Tangents are generated only when the pipeline requires them (e.g., normal mapping).
7. Units & Coordinate System
  * Assume meters as scene unit (unless Preferences override).
  * glTF uses a right-handed system, Y-up. OBJ is ambiguous; treat as right-handed, Y-up by default.
8. Caching & Deduplication
  * Node caches the parsed result by file content hash; reusing the same file across nodes avoids reparsing.
  * Clearing cache occurs on file change or user “Reload”.
9. Serialization
  * Scene saves node parameters and metadata, not the file’s binary contents.
  * When exporting a project bundle, offer an option to embed/attach assets so the scene is portable.
10. Limits & Performance
* Very large assets (high poly counts, many textures) may affect frame time and memory.
* Consider optional mesh simplification or instancing strategies later.

---

Import glTF

Formats: .glb, .gltf (+ .bin + textures)
Three.js: GLTFLoader (+ optional DRACOLoader, MeshoptDecoder, KTX2Loader)

Purpose

Load modern assets with PBR materials, animations, and common extensions.

Behaviors

* Parses scenes, nodes, meshes, materials, textures, animations.
* Respects PBR parameters (BaseColor/MetallicRoughness, Normal, Emissive, Occlusion).
* Handles common extensions when the corresponding decoders are configured:
  * KHR_draco_mesh_compression (Draco)
  * EXT_meshopt_compression (Meshopt)
  * KHR_materials_unlit, KHR_materials_transmission, KHR_texture_transform, KHR_lights_punctual, KHR_materials_specular, KHR_materials_ior, KHR_materials_clearcoat, KHR_materials_sheen (where applicable)
  * KHR_texture_basisu when KTX2Loader is set up
* Animations are loaded and retained in the object, but do not auto-play unless your sub-flow or preferences define that behavior.

Ports

* Output: geometry/object group (root Object3D of the imported glTF scene or the first mesh group).

Parameters

* General
  * Name (editable)
  * Description: “Load geometry from .gltf/.glb file.” (read-only)
* glTF Model
  * File: File picker; accepts .glb or .gltf (with referenced files).
  * Scale Factor: default 1; range 0.0001–100 (applies uniform scale).
  * Center to Origin: Boolean; default Off (recenters by bounding box center).
  * Preserve Materials: Boolean; default On (keep glTF materials).
  * Use Draco/Meshopt: Auto if loader is configured; show read-only indicator reflecting availability.
  * Generate Missing Normals: Boolean; default On.
  * Apply Texture Colorspace: Boolean; default On (sRGB for color textures).
* Rendering
  * Visible: Boolean.
* Advanced (optional section you can hide by default)
  * Flatten Scene to Single Group: Boolean; default Off (merges nodes under one group for simpler downstream usage).
  * Merge Geometries by Material: Boolean; default Off (best for static assets to reduce draw calls).
  * Freeze World Matrices: Boolean; default Off (bakes transforms to vertices; destructive for animation).

UI States

* Idle: no file selected.
* Loading: progress bar (if available); cancel button.
* Loaded: file name, triangle count, materials count, extensions detected.
* Error: readable message; “Retry” and “Choose different file”.

Implementation Notes

* Initialize optional decoders once (Draco, Meshopt, KTX2).
* On load, compute and store: bounding box, bounding sphere, triangle count, node count.
* Ensure renderer is configured for correct color management (e.g., linear rendering with sRGB textures).
* If Flatten or Merge is enabled, perform after loader resolves the scene; keep original in cache for toggling.
* When Preserve Materials is Off, assign a default material consistent with your display modes.

---

Import OBJ

Formats: .obj (+ optional .mtl + textures)
Three.js: OBJLoader (+ optional MTLLoader)

Purpose

Load legacy/static meshes authored as OBJ, optionally with MTL materials.

Behaviors

* Parses polygonal geometry; OBJ has no inherent units or PBR materials.
* If an .mtl file is provided and found, MTLLoader creates basic materials (Phong/Lambert-style).
* Normals may be missing or inconsistent; recomputation is often required.

Ports

* Output: geometry/object group (root group containing imported meshes).

Parameters

* General
  * Name (editable)
  * Description: “Load geometry from .obj file.” (read-only)
* OBJ Model
  * File: File picker; accepts .obj.
  * Material File (.mtl): Optional file picker; associates an MTL file if present.
  * Scale Factor: default 1; range 0.0001–100.
  * Center to Origin: Boolean; default Off.
  * Preserve Materials: Boolean; default On (uses MTL if provided; otherwise keeps per-mesh materials created by loader).
  * Generate Missing Normals: Boolean; default On.
* Rendering
  * Visible: Boolean.
* Advanced (optional)
  * Weld Vertices: Boolean; default Off (merge duplicate vertices by position/normal/uv).
  * Triangulate Faces: Boolean; default On (ensure consistent downstream processing).
  * Merge Geometries by Material: Boolean; default Off.

UI States

* Same as glTF: Idle, Loading, Loaded (show counts), Error.

Implementation Notes

* If .mtl is provided, parse it first, then set OBJLoader.setMaterials(mtlCreator).
* After load, traverse and ensure geometry.index exists (if triangulating/merging).
* Recompute normals if missing/invalid; consider smoothing based on a configurable angle (future enhancement).
* OBJ often lacks proper scale; encourage users to set Scale Factor or use a downstream Transform.

---

Shared Diagnostics (recommended)

* Stats panel in node inspector after successful load:
  * Triangles, vertices, draw calls, materials, textures.
  * Bounding box (min/max), world size estimate.
  * Extensions used (for glTF).
* Actions:
  * Reload (reparse same file), Replace File, Center Now (apply once), Compute Normals.

---

Example Workflows

1. Importing a glTF product model
  * Import glTF → File: chair.glb, Preserve Materials: On, Center to Origin: On, Scale: 1.
  * Add Transform → rotate/position the chair.
  * Add Lights → Rect Area Light for soft highlights.
2. Importing an OBJ architectural mass
  * Import OBJ → File: massing.obj, MTL: none, Generate Normals: On, Scale: 0.01 to convert centimeters to meters, Center to Origin: On.
  * Add Transform → place relative to site.
  * Later replace with glTF when PBR materials are available.
3. Heavy glTF with Draco compression
  * Ensure Draco is configured.
  * Import glTF → the node indicates “Draco: enabled”.
  * Enable Merge Geometries by Material to reduce draw calls for static visualization.

Quick Summary (copy/paste)

* Import glTF: modern .glb/.gltf with PBR, extensions (Draco/Meshopt/KTX2 when available), animations retained. Ports: 0 in → 1 out.
* Import OBJ: legacy .obj (+ optional .mtl), normals often recomputed; basic materials only. Ports: 0 in → 1 out.
* Both are sub-flow only, async, privacy-preserving (local file picker), and support Scale Factor + Center to Origin.
* Output is a group attached to the sub-flow; use Transform downstream for placement beyond scaling.
* Serialization stores parameters/metadata; bundling can embed assets for portability.

---

Modifiers (Sub-flow)



Transform Node

Purpose

The Transform node changes the position, rotation, and scale of geometry passed into it.
It is the basic modifier in sub-flows and is intended to be chained with other nodes.

Context

* Where it can be used: Inside a Geo node sub-flow only.
* Ports:
  * 1 input (geometry)
  * 1 output (geometry)
* Flow role: It always needs an input to work (e.g., a primitive or importer). Its output is forwarded geometry with updated transforms.

Behavior

* Takes the geometry received from its input.
* Applies translation (Position), rotation, and scaling (Scale + Scale Factor).
* Produces a new version of that geometry which is then available to any downstream node.
* Multiple Transform nodes can be chained together; each one applies its adjustments on top of the previous node’s result.
* Visibility controls whether the transformed geometry is shown in the 3D viewport.
  * If Visible is Off → geometry is still passed downstream but not drawn.
  * If Visible is On → geometry is drawn in the scene.

Parameters

* General
  * Name: Editable text (auto-increments when new nodes are created, e.g. “Transform 1”, “Transform 2”).
  * Description: “Applies transformations to input geometry.” (read-only).
* Transform
  * Position: X, Y, Z values. Default (0, 0, 0).
  * Rotation: X, Y, Z values (degrees or radians, depending on UI convention). Default (0, 0, 0).
  * Scale: X, Y, Z values. Default (1, 1, 1).
  * Scale Factor: Single numeric multiplier applied to the whole geometry. Default 1.
* Rendering
  * Visible: On by default. Toggles whether the geometry shows in the viewport.

Example Usage

1. Simple move
  * Box → Transform(Position Y = 5) → Output
  * Result: A box raised 5 units above origin.
2. Stacked transforms
  * Sphere → Transform(Scale 2,2,2) → Transform(Rotation X = 45)
  * Result: The sphere is scaled up, then rotated.
3. With import
  * Import glTF → Transform(Scale Factor = 0.01, Center to Origin On)
  * Result: Imported model scaled down to scene units and centered at origin.



Combine Node

Context: Sub-flow (inside a Geo container)
Ports: 4 inputs (geometry) → 1 output (geometry)

Purpose

Collect up to four upstream geometry inputs (from any branches within the same Geo sub-flow) and pass them forward as a single output. Used to assemble multiple primitives/imports/modifier chains into one combined result.

Behavior

* Accepts geometry from 0–4 inputs.
* Unconnected inputs are ignored.
* Output is a single group that contains all connected input results as children (no additional transforms are applied by this node).
* Order is deterministic and follows input slot index (Input 1, then 2, 3, 4).
* If all inputs are empty/null, the output is null (node reports “No inputs”).
* Inputs must come from within the same Geo sub-flow; cross-Geo connections are not allowed.
* Lights and utility nodes are not valid inputs.

Parameters

* General
  * Name: Editable text (auto-incremented, e.g., “Combine 1”).
  * Description: “Combines up to four geometry inputs into a single output.” (read-only)
* Rendering
  * Visible: On/Off (when Off, output is still produced for downstream nodes but not drawn).

Notes for Engineering

* The node should not modify transforms or materials; it only groups inputs.
* Preserve the incoming object hierarchies for each input under a child group per input slot to maintain predictable structure.
* Compute the node’s output bounding box/sphere from union of connected inputs (for viewport framing and stats).
* Ensure stable IDs for child groups (e.g., input1, input2, etc.) to keep diffing predictable across evaluations.
* If any input is an InstancedMesh or already a Group, include it as-is (no de-instancing, no merging).

Example Usage

1. Assemble primitives
  * Box → Transform → (Input 1)
  * Sphere → Transform → (Input 2)
  * Combine → Output to downstream node(s)
2. Mix import and generated geometry
  * Import glTF (chair) → (Input 1)
  * Torus Knot (accent object) → (Input 2)
  * Combine → Transform (place the set)
3. Multiple branches
  * Branch A (Facade panels) → (Input 1)
  * Branch B (Structure) → (Input 2)
  * Branch C (Context mass) → (Input 3)
  * Combine → Material/Transform downstream

