Use Case Examples

Some sample use cases for typical parameteric design use cases from user stand point!

Core evaluation model (reference)

* DAG per Geo: Each Geo owns a sub-flow DAG. The Geo evaluates only what’s needed for its final visible output(s).
* Draw vs Data: “Visible” controls drawing only; the node’s output still flows downstream and can be consumed even if not drawn.
* Trigger types
  * Parameter change on a node invalidates that node and every downstream node in its branch; only those are recomputed.
  * Visibility On for node N ensures the entire upstream branch that feeds N is valid; any stale ancestors are recomputed.
Visibility Off removes N’s drawables from the scene; no ancestors are recomputed.
  * Connection change invalidates the affected downstream branch and recomputes from the change point down.
  * Importer load/replace completes asynchronously; on completion the importer’s output version updates and downstream nodes recompute.
* Geo container transform: Applying Position/Rotation/Scale/Scale Factor on the Geo does not recompute the sub-flow; it updates the Geo’s scene Group transform.
* Terminal visibility (best practice): Designate a single terminal node (often a Combine or final Transform) as Visible: On to avoid duplicate drawings. The engine can union multiple terminal visibles, but docs should steer users toward one terminal visible per Geo for clarity.

Use Case 0 — Build a multi-branch sub-flow (imports + primitives + variants), add lights, and control visibility

Goal

A user creates a Geo container with lights in the scene, then—in the Geo’s sub-flow—builds two modeling branches:

* Branch A: Import OBJ + Box + Sphere, merged with Combine A, then adjusted by a final Transform A_final.
* Branch B (variants): one Torus Knot feeding three different Transform nodes, merged with Combine B, optionally adjusted by Transform B_final.

The user edits transform parameters and toggles Visible on selected nodes to control what’s drawn. The viewport updates immediately and only the necessary nodes recompute.

---

Context & Preconditions

* Scene level: Lights and one Geo container. Lights are handle-less (no connections).
* Geo sub-flow (inside the container): vertical layout, inputs on top, outputs on bottom.
* Visibility rule: Visible affects drawing only; data still flows downstream when a non-terminal node is set Visible Off.
* Evaluation: Changes invalidate only affected nodes and their downstream consumers. Geo’s own transform/shadow flags do not recompute the sub-flow.

---

Main Flow

A) Scene setup

1. Create Geo (e.g., “Geo 1”). Leave default Render/Cast/Receive Shadow = On.
2. Add Lights at the scene level (examples):
  * Directional Light (sun): set Position, Target, Intensity, and Cast Shadow = On.
  * Ambient Light (fill): low Intensity (e.g., 0.2–0.4).
  * (Optional) Rect Area Light for soft fill.
Effect: Lights alter rendering only; no sub-flow recomputation occurs.

B) Build Branch A (imports + primitives)

1. Enter Geo 1 (sub-flow editor).
2. Add Import OBJ. Select file. State goes Loading → Loaded (async).
  * Parameters: Scale Factor, Center to Origin, Generate Missing Normals as needed.
3. Add Box → add Transform Box_T and connect: Box → Box_T.
4. Add Sphere → add Transform Sphere_T and connect: Sphere → Sphere_T.
5. Add Combine A (4 inputs). Connect inputs in order:
  * Input 1: Import OBJ
  * Input 2: Box_T
  * Input 3: Sphere_T
  * Input 4: (unused)
6. Add Transform A_final and connect: Combine A → Transform A_final.
7. Set Transform A_final.Visible = On. (Set other nodes Visible = Off to avoid duplicate drawing.)

Result: Branch A produces a single drawable output (the Transform A_final result) that includes the imported object and the transformed Box and Sphere.

C) Build Branch B (single generator, three variants)

1. Add Torus Knot.
2. Create three Transform nodes with different parameters:
  * Torus Knot → Transform TK_T1 (e.g., Scale 1, Rotation 0,0,0)
  * Torus Knot → Transform TK_T2 (e.g., Scale 1.5, Rotation 0,45,0)
  * Torus Knot → Transform TK_T3 (e.g., Scale 0.75, Rotation 30,0,15)
3. Add Combine B and connect in order:
  * Input 1: TK_T1
  * Input 2: TK_T2
  * Input 3: TK_T3
  * Input 4: (unused)
4. (Optional) Add Transform B_final and connect: Combine B → Transform B_final.

Visibility options:

* Option 1 (one terminal): Set Transform B_final.Visible = On, and leave Combine B and the individual TK transforms Visible = Off.
* Option 2 (multi-terminal): Set Combine B.Visible = On (draws three variants as one group).
(Best practice: prefer a single terminal visible per branch for clarity and fewer draw calls.)

---

Parameter Editing & Immediate Feedback

1. Edit transform parameters (live):
  * Move Box_T.Position Y to raise the box.
  * Adjust Sphere_T.Scale to resize the sphere.
  * Tweak Transform A_final.Rotation to rotate the whole Branch A assembly.
  * Change TK_T2.Rotation Y and TK_T3.Scale Factor to vary the torus knot clones.
2. Expected behavior:
  * Editing Box_T invalidates Box_T → Combine A → Transform A_final only.
  * Editing Sphere_T invalidates Sphere_T → Combine A → Transform A_final only.
  * Editing Transform A_final recomputes Transform A_final only (upstream reused).
  * Editing TK_T2 invalidates TK_T2 → Combine B → (Transform B_final if present) only; TK_T1 and TK_T3 are reused.
  * Import OBJ loads asynchronously; once loaded, it triggers Combine A → Transform A_final to recompute; Branch B unaffected.

Viewport updates immediately after each change; unrelated nodes do not recompute.

---

Visibility Control Scenarios

1. Toggle visibility on selected nodes:
* Turn Transform A_final.Visible = Off → Branch A stops drawing, but remains available to downstream consumers (if any).
* Turn Combine B.Visible = On (if not using B_final) → Branch B draws the group of TK variants.
* If both Transform A_final and Transform B_final (or Combine B) are Visible = On, both groups will draw inside the same Geo.
(Fine for exploration; for production, pick one terminal visible per branch.)
1. Toggling lights (scene level) changes brightness/shadows but does not cause any sub-flow recompute.

---

Recompute Scope Summary (what recomputes when)

* Change on a Transform → that Transform and its downstream nodes recompute (e.g., Combine, then final Transform). Upstream generators (Box/Sphere/Torus Knot/Import) are reused unless their own params change.
* Change on a Combine → the Combine and downstream consumers recompute; connected inputs are reused unless they changed.
* Import OBJ completes/reloads → Combine A and downstream recompute; Branch B unaffected.
* Geo transform/shadow flags → update the scene Group only; no sub-flow recompute.
* Lights → renderer updates only; no sub-flow recompute.

---

Acceptance Criteria

* Creating lights and toggling their parameters updates the scene without triggering node recomputation in the Geo sub-flow.
* Connecting Box → Box_T, Sphere → Sphere_T, and wiring to Combine A → Transform A_final yields a single drawable output when Transform A_final.Visible = On.
* Creating Torus Knot with three parallel Transform variants and wiring to Combine B produces three distinct variants; setting Combine B.Visible = On draws all three (or use Transform B_final.Visible = On for a single terminal).
* Editing any Transform parameter updates the 3D viewport immediately and recomputes only the affected branch plus its downstream nodes.
* Importer asynchronous behavior is correctly reflected: while loading, Branch A’s import contribution is pending; on success, only the necessary downstream nodes update.
* Toggling Visible on any non-terminal node hides its own drawables (if any) but does not interrupt data flow to downstream nodes.

---

Notes & Variations

* You can add a final Combine All to merge Transform A_final with Combine B (or Transform B_final), then expose a single terminal visible for the whole sub-flow.
* If Import OBJ fails, Combine A outputs only connected, valid inputs (Box_T and Sphere_T) and surfaces an error state for the importer.
* Rewiring (e.g., replacing Sphere_T with a Cylinder → Transform) invalidates from the changed input forward (Combine A → Transform A_final) without touching Branch B.

---

Use Case 01 — Live transform tweak with immediate feedback

Goal: User edits Transform parameters and sees an immediate update in 3D.

* Context: Sub-flow inside a Geo. Chain: Box → Transform → (terminal visible).
* Trigger: User drags the Transform’s Position Y slider.
* Main flow
  1. UI change updates Transform params (degrees→radians conversion if used for rotation).
  2. Engine invalidates Transform and any downstream nodes.
  3. Engine recomputes Transform output and updates the terminal visible’s drawables in the Geo’s Group.
* Expected result: The box moves in real time. Upstream Box is not recomputed.
* Acceptance criteria
  * No recompute of nodes that are not downstream of Transform.
  * Viewport reflects every slider tick (debounce allowed but no laggy “catch-up”).

---

Use Case 02 — Building and connecting a basic chain

Goal: User creates a simple chain and connects nodes in vertical order.

* Context: Sub-flow in Geo.
* Preconditions: Empty sub-flow.
* Main flow
  1. Add Box (0 in, 1 out).
  2. Add Transform (1 in, 1 out). Connect Box → Transform (top input).
  3. Set Transform.Visible = On; leave Box.Visible off (best practice).
  4. Geo evaluates Transform branch and draws result in its Group.
* Expected result: Only the transformed Box is drawn.
* Acceptance criteria
  * Ports and handles align vertically, connections snap to top inputs/bottom outputs.
  * If Transform.Visible = Off but it feeds another node later, data still flows.

---

Use Case 03 — Multi-branch modeling with Combine as terminal

Goal: Assemble multiple branches in one sub-flow and render a single terminal output.

* Context: Sub-flow.
* Setup:
  * Branch A: Sphere → Transform
  * Branch B: Torus Knot → Transform
  * Add Combine (4 in, 1 out). Connect both transforms to Combine inputs.
  * Set Combine.Visible = On; others Visible = Off.
* Main flow
  1. Engine computes Sphere and its Transform (A), TorusKnot and its Transform (B).
  2. Engine computes Combine, grouping A and B results (order by input slot).
  3. Geo draws only Combine’s output.
* Expected result: One group containing the two meshes, drawn once.
* Acceptance criteria
  * Disabling visibility on a branch’s intermediate node does not break the data path unless the node is terminal.
  * Combine does not alter transforms/materials—only groups inputs.

---

Use Case 04 — Toggling visibility mid-chain

Goal: Clarify what happens when a mid-chain node’s Visible flag changes.

* Context: Box → Transform A → Transform B → (terminal)
* Scenario A (turn Off Transform A.Visible):
  * The chain still computes normally. Transform A’s output feeds B; the scene drawables associated with A alone are hidden.
* Scenario B (turn Off terminal.Visible):
  * The chain may still compute if another consumer exists; otherwise nothing is drawn for this branch.
* Acceptance criteria
  * Visible only affects drawing; data continues to flow unless the node is terminal and unused downstream.

---

Use Case 05 — Parameter change upstream of Combine

Goal: Show recomputation scope when editing a branch that feeds Combine.

* Context: From UC-03. User edits the Torus Knot’s “P” parameter.
* Main flow
  1. Torus Knot invalidates itself and downstream nodes in Branch B (Transform B, Combine).
  2. Branch A is untouched.
  3. Engine recomputes Torus Knot → Transform B → Combine; redraws Combine group.
* Expected result: Only Branch B and Combine recompute; Branch A is reused from cache.
* Acceptance criteria
  * Recompute span is minimal: exactly “changed node to terminal consumer”.
  * Frame rate remains stable with partial updates.

---

Use Case 06 — Geo container transform adjustment

Goal: Demonstrate container-level transforms without sub-flow recompute.

* Context: Any sub-flow with a terminal visible (often Combine).
* Trigger: User edits Geo.Rotation Y = 90°.
* Main flow
  1. Engine applies rotation to the Geo’s Three.js Group.
  2. No sub-flow nodes are recomputed.
* Expected result: Whole sub-flow appears rotated.
* Acceptance criteria
  * Sub-flow compute times are zero for this action.
  * Object hierarchy remains intact; only parent Group world matrix changes.

---

Use Case 07 — Rewiring a chain

Goal: Show behavior when changing connections.

* Context: Box → Transform → Combine, Sphere → (unused)
* Action: Disconnect Box → Transform. Connect Sphere → Transform.
* Main flow
  1. The downstream branch from Transform is invalidated.
  2. Engine recomputes Transform (with Sphere input) → Combine; redraws.
* Expected result: Combine now shows Sphere branch in place of Box branch.
* Acceptance criteria
  * No recomputation for nodes not on the affected path.
  * Orphaned Box remains computed in cache but not consumed.

---

Use Case 08 — Async import feeding a downstream chain

Goal: Clarify importer loading and downstream recompute.

* Context: Import glTF → Transform → Combine (terminal) alongside a second branch.
* Main flow
  1. User selects a .glb file. Importer enters “Loading”. Downstream nodes mark “pending” and render nothing from this branch.
  2. On load success, importer output version updates; Transform and Combine recompute; Combine redraws with both branches.
  3. On load failure, importer goes to “error”; downstream gets null; Combine draws only the other connected inputs.
* Acceptance criteria
  * No blocking of the entire sub-flow while one importer loads.
  * Clear UI states: Idle/Loading/Loaded/Error.
  * “Retry/Replace” triggers the same invalidate→recompute pipeline.

---

Use Case 09 — Turning a branch visible later

Goal: Show on-demand computation when revealing a previously hidden branch.

* Context: Branch C exists but its terminal node is Visible: Off and not consumed by Combine.
* Action: User sets Branch C terminal Visible: On (or connects it into Combine).
* Main flow
  1. Engine validates all upstream nodes that feed the now-visible terminal or the newly connected Combine input.
  2. Only the needed nodes compute; scene updates accordingly.
* Expected result: Branch C becomes visible; other branches unchanged.
* Acceptance criteria
  * No global recompute; only the newly demanded branch runs.

---

Use Case 10 — Scene lights and recomputation boundaries

Goal: Confirm lights don’t cause Geo recomputation.

* Context: Scene has Directional Light and multiple Geo containers.
* Action: Toggle Directional Light Visible or adjust light Intensity.
* Main flow
  1. Light parameters update; renderer re-shades the scene.
  2. No Geo sub-flow nodes recompute.
* Expected result: Lighting changes instantly; geometry compute cache untouched.
* Acceptance criteria
  * Zero node recomputes are attributed to light changes.
  * Shadow toggles can affect renderer state, never sub-flow compute.

---

Use Case 11 — Deleting a node used by a branch

Goal: Define behavior when removing a node that others depend on.

* Context: Box → Transform → Combine (terminal)
* Action: Delete Transform.
* Main flow
  1. Engine invalidates downstream chain from the deleted node; Combine input becomes null.
  2. Combine recomputes with remaining connected inputs (if any).
* Expected result: The Combine output updates without the deleted path.
* Acceptance criteria
  * No stale drawables remain in the scene for the deleted path.
  * Errors are user-friendly if deletion would leave a node unconfigured.

---

Use Case 12 — Duplicate branch and caching

Goal: Show effective reuse when duplicating an identical branch.

* Context: Import OBJ → Transform → Combine (terminal)
* Action: Duplicate the importer branch and connect to a new Combine input.
* Main flow
  1. If the same file is reused and content hash matches, importer cache is reused (no reparse).
  2. Only the new Transform and Combine recompute.
* Expected result: Two identical meshes appear; load time minimal.
* Acceptance criteria
  * Import cache hits are visible in diagnostics.
  * No redundant file parsing occurs.

---

Use Case 13 — Switching the terminal node

Goal: Avoid double drawing and clarify terminal practices.

* Context: Two branches both set Visible: On accidentally.
* Action: Turn Visible: Off on the non-terminal branch and set Combine.Visible = On as the sole terminal.
* Main flow
  1. Non-terminal branch still computes to feed Combine; it just doesn’t draw by itself.
  2. Only Combine draws the union result.
* Expected result: One final rendering with no duplicates.
* Acceptance criteria
  * No change in geometry, only deduplicated drawing.
  * Viewport statistics (draw calls) reflect the consolidation.

---

Use Case 14 — Geo-level shadow flags

Goal: Show container-level rendering flags without compute changes.

* Context: Any Geo with terminal visible.
* Action: Toggle Geo.Cast Shadow or Receive Shadow.
* Main flow
  1. Flags apply to the Geo Group and propagate to children unless overridden by materials.
  2. No sub-flow recompute.
* Expected result: Shadow behavior updates in rendering only.
* Acceptance criteria
  * No node recomputes.
  * Shadow map allocation/disposal handled by renderer, not node engine.

---

Use Case 15 — Replace file on importer

Goal: Verify incremental recomputation after replacing a model.

* Context: Import glTF (chair.glb) → Transform → Combine
* Action: Replace file with bench.glb.
* Main flow
  1. Importer enters Loading; downstream marks pending.
  2. On success, importer output version increments; Transform and Combine recompute; redraw.
* Expected result: Chair becomes bench; other branches unchanged.
* Acceptance criteria
  * Only importer branch + Combine recompute.
  * Errors surface clearly if referenced files are missing.

---

Evaluation rules summary (for docs and engineering)

1. On param change: Recompute from that node to all its visible or otherwise-consumed descendants.
2. On visibility change:
  * On → validate and compute full upstream chain for that node (or for any node newly consuming it).
  * Off → remove that node’s drawables; do not recompute anything.
3. On connection change: Invalidate from the changed input forward; recompute descendants.
4. On importer complete/error: Update downstream consumers accordingly; never block unrelated branches.
5. On Geo transform/shadow flags: Update scene Group only—no sub-flow recompute.

---

If you want, I can convert these into /docs/use-cases/*.md files (one per use case, with front-matter and cross-links), or tailor them into “Given/When/Then” acceptance tests for your QA checklist.