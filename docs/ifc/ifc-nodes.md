Got it. Here’s a practical, Minimystx-ready node set for IFC, organized by phases. Each entry lists purpose, key inputs/outputs, and the parameters that matter. You can lift these straight into your node catalog and wire them into your existing Three.js scene + graph engine.

# Phase 1 — Read, explore, filter, visualize (MVP)

## 1) IFC File Loader

* Purpose: Load one IFC into memory and register it in the session.
* Inputs: fileBlob | url
* Outputs: modelHandle, modelMeta (schema, counts), rootExpressId
* Params: placeAtOrigin (bool), convertBooleansFast (bool), lazyGeometry (bool)
* Notes: Emits an idempotent `modelHandle` used downstream.

## 2) IFC Model Info

* Purpose: Inspect high-level stats.
* Inputs: modelHandle
* Outputs: modelMeta {schema, entityCounts by type, storeys, sites, buildings}, guid↔expressId index
* Params: includeTypeHistogram (bool)

## 3) Spatial Structure

* Purpose: Get IFC Project→Site→Building→Storey tree.
* Inputs: modelHandle
* Outputs: spatialTree (nodes with expressId, type, name, children\[])
* Params: includeNonSpatial (bool)
* Notes: Foundation for “browse by storey”, isolation, explode, etc.

## 4) Elements by Type

* Purpose: Fast filter by IFC class (e.g., IfcWall, IfcDoor).
* Inputs: modelHandle
* Outputs: elementSet (expressId\[])
* Params: type (enum/multiselect), includeSubtypes (bool)

## 5) Elements in Spatial Container

* Purpose: Get all products contained in a given storey/building/site.
* Inputs: modelHandle, spatialNodeId (expressId)
* Outputs: elementSet
* Params: deep (include descendants), includeTypes (optional allowlist)

## 6) Select by GUID / by IDs

* Purpose: Translate identifiers to a working set.
* Inputs: modelHandle, guidList | idList
* Outputs: elementSet
* Params: strict (error on missing), ignoreMissing (bool)

## 7) Property Fetch

* Purpose: Read full property bundle for a set.
* Inputs: modelHandle, elementSet
* Outputs: propsTable (row per element with attributes, psets, qto, materials)
* Params: recursive (bool), includeMaterials (bool), includeQTO (bool)

## 8) Filter by Property

* Purpose: Predicate filter on property/attribute.
* Inputs: propsTable | (modelHandle, elementSet)
* Outputs: elementSet (filtered)
* Params: key (pset.prop or attribute), op (=, ≠, >, <, contains, regex), value, caseSensitive

## 9) Material Query

* Purpose: Get/Filter elements by material.
* Inputs: modelHandle, elementSet?
* Outputs: {materials\[], elementSetByMaterial: Map\<mat, ids\[]>}
* Params: materialName match (string/regex)

## 10) Geometry Extract

* Purpose: Produce renderable geometry for an element set.
* Inputs: modelHandle, elementSet
* Outputs: meshBundle (BufferGeometry\[], metadata per mesh: expressId, type, color)
* Params: mergeByType (bool), indexOptimization (bool), computeNormals (bool)
* Notes: Hands you Three.js-ready data; you attach materials in a renderer node.

## 11) Render Control (Show/Hide/Isolate)

* Purpose: Control visibility without re-computing geometry.
* Inputs: meshBundle | elementSet
* Outputs: renderMask (ids to show/hide), passthrough meshBundle
* Params: mode: show|hide|isolate, persist (bool)

## 12) Colorize by Property/Type

* Purpose: Classification visualization.
* Inputs: elementSet | meshBundle, propsTable?
* Outputs: colorOverrides (Map\<expressId, color>), passthrough meshBundle
* Params: scheme: byType|byProperty, key (when byProperty), palette (categorical/gradient)

## 13) Bounding Boxes / Focus

* Purpose: Compute AABBs and optionally frame camera.
* Inputs: meshBundle | elementSet (with lazy fetch of geom)
* Outputs: aabbs\[], sceneBounds
* Params: expand (margin), fitCamera (bool)

## 14) Set Ops (Union / Intersect / Subtract of element sets)

* Purpose: Boolean on *sets of IDs* (not geometric boolean).
* Inputs: elementSet A, elementSet B
* Outputs: elementSet
* Params: op: union|intersect|subtract

## 15) Selection Bridge (3D → IFC)

* Purpose: Map user picks back to IFC ids.
* Inputs: pickEvent(s) from viewport
* Outputs: elementSet (selected)
* Params: multiSelect (bool), toggle (bool)

# Phase 2 — Relationships, performance, multi-model

## 16) Related Elements

* Purpose: Traverse IFC relations (e.g., RelAggregates, RelVoidsElement).
* Inputs: modelHandle, elementSet
* Outputs: elementSet (related)
* Params: relationType (enum), direction: forward|inverse, depth (1..N)

## 17) Stream Meshes

* Purpose: Incremental geometry streaming for large models.
* Inputs: modelHandle, elementSet?
* Outputs: meshStream (async iterator) → meshBundle chunks
* Params: batchSize (faces/elems), priority (by type/storey)

## 18) Cache/Index Builder

* Purpose: Build indices for fast queries (type map, GUID map, storey index).
* Inputs: modelHandle
* Outputs: indexHandle (used implicitly by other nodes)
* Params: persistInSession (bool)

## 19) Multi-Model Loader

* Purpose: Manage multiple IFCs in one scene.
* Inputs: fileBlob|url (N…)
* Outputs: modelHandles\[], registry
* Params: autoOffset (avoid overlap), name tags

## 20) Model Diff (by GUID)

* Purpose: Compare two models, label added/removed/changed.
* Inputs: modelHandle A, modelHandle B
* Outputs: {added\[], removed\[], changed\[]}, colorOverrides
* Params: compareProps (keys), tolerance for numeric props

## 21) Explode by Storey/Type

* Purpose: Visualization aid; offsets element groups.
* Inputs: elementSet | meshBundle, spatialTree
* Outputs: transformOverrides (Map\<id, matrix>)

# Phase 3 — QA/analysis

## 22) Rule Check: Property Compliance

* Purpose: Validate elements against rules (e.g., FireRating ≥ 30).
* Inputs: propsTable | (modelHandle, elementSet)
* Outputs: passSet, failSet, report
* Params: rules\[] {scope selector, key, op, value}

## 23) Clash (AABB) Pre-Check

* Purpose: Fast bounding-box clash for coarse QA.
* Inputs: meshBundle A, meshBundle B
* Outputs: pairs\[], highlight overrides
* Params: expand (epsilon), ignorePairs (type combos)

## 24) Duplicate GUID / Missing Data Scan

* Purpose: Basic data sanity.
* Inputs: modelHandle
* Outputs: issues\[] {type, ids, details}

# Phase 4 — Authoring (future: add/remove/edit/export)

## 25) Write Property Value

* Purpose: Change or add a property value on elements.
* Inputs: modelHandle, elementSet
* Outputs: mutationHandle, passthrough elementSet
* Params: psetName, propName, value, type

## 26) Attach/Detach Property Set

* Purpose: Link/unlink existing Pset to/from elements.
* Inputs: modelHandle, elementSet, psetId
* Outputs: mutationHandle

## 27) Create Property Set

* Purpose: New Pset with typed props.
* Inputs: modelHandle
* Outputs: psetId
* Params: psetName, props\[] {name, type, value}

## 28) Add Element (Template-Based)

* Purpose: Instantiate a new element from a template (e.g., standard wall).
* Inputs: modelHandle, spatialNodeId, templateRef
* Outputs: elementId
* Params: name, transformation, basic dims

## 29) Remove Elements

* Purpose: Remove elements from model (update relations).
* Inputs: modelHandle, elementSet
* Outputs: mutationHandle, removedIds\[]
* Params: safeMode (checks references), dryRun

## 30) Export IFC

* Purpose: Serialize to .ifc.
* Inputs: modelHandle | mutationHandle (latest)
* Outputs: fileBlob (ifc)
* Params: schema target (keep original vs normalize), prettyPrint (bool)

# Cross-cutting utilities

## U-1) Model Registry

* Central service node that maps `modelHandle → indices, caches, name, color`.

## U-2) Type/Schema Dictionary

* Exposes available IFC types, property keys, relation enums for UI dropdowns.

## U-3) Throttle/Debounce

* Wraps expensive nodes (geometry extract, property fetch) to avoid thrash.

## U-4) Diagnostics

* Collects parse errors, timings, memory footprint.

# Data contracts (suggested)

* `modelHandle`: opaque reference to a loaded IFC in WASM.
* `elementSet`: `{ modelHandle, ids: number[] }`.
* `propsTable`: rows keyed by `expressId` with `{attributes, psets, qto, materials}`.
* `meshBundle`: `{ modelHandle, meshes: Array<{expressId, bufferGeometryRef, defaultColor}> }`.
* `renderMask`: `{ show?: number[], hide?: number[], isolate?: number[] }`.
* `colorOverrides`: `Map<number, number /* RGB int or hex */>`.
* `transformOverrides`: `Map<number, Matrix4Like>`.

# Wiring suggestions (Minimystx parametric flow)

* Keep **data nodes** pure (no scene mutation): loaders, filters, property readers.
* Apply **render nodes** near the output: geometry extract → colorize → render control.
* Use **elementSet** as the lingua franca between filters and geometry nodes.
* Maintain a per-model **index cache**; regenerate only when loader hash changes.
* Gate heavy nodes with **Throttle/Debounce** and prefer **Stream Meshes** for big files.
