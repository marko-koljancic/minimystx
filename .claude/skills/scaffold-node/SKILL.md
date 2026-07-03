---
name: scaffold-node
description: >-
  Scaffold a new Minimystx node type across all five wiring files, using an existing node as the
  template. Use when the user wants to add a new node (primitive, modifier, import, light, or
  utility) to the node editor, or asks to "add a node", "scaffold a node", "create a new
  primitive/modifier/light", or similar. Handles the mechanical 5-file wiring; hand the compute
  logic to the node-author (/node) for design and review.
---

# Scaffold a Minimystx node type

A node in Minimystx is wired across five files. Missing any one makes the node fail silently: it
will not appear in the palette, will not render, or will produce no output. This skill walks all
five, using the closest existing node as the template. It does the mechanical wiring; the compute
logic and port/parameter design should be filled and reviewed by the node-author agent (`/node`).

## Before you start

1. Confirm the essentials with the user (or infer from the request and state your assumptions):
   - Node name (for example `Cylinder2`) and category. Existing categories: `3D Primitives`,
     `Modifiers`, `Import`, `Lights`, `Container`, `Utility`. Folders live under `src/flow/nodes/`
     (note `2D_primitives`, `IFC`, `Shading` are empty scaffolds).
   - Its inputs (ports it consumes) and outputs (ports it produces), each a `ConnectionType`.
   - Its parameters, each with a type, a `displayName`, and a sensible default and range.
2. Open the closest existing node as your template and copy its shape rather than inventing one:
   - A geometry primitive: `src/flow/nodes/3D_Primitives/Box.ts` + `BoxNode.tsx`.
   - An input-consuming modifier: `src/flow/nodes/Modifiers/Transform.ts`.
   - A light: `src/flow/nodes/Lights/` (these use eager `compute`, not `computeTyped`).
3. Read `CLAUDE.md` "Adding a new node type", `src/engine/nodeParameterFactories.ts`, and
   `src/engine/containers/BaseContainer.ts` so you use the real param and container APIs.

## The five files

### 1. `src/flow/nodes/<Category>/<Name>.ts`

Export three things:

- `<name>NodeParams: NodeParams` - a two-level object `{ category: { key: ParameterMetadata } }`.
  Build entries with `createParameterMetadata(type, default, { displayName, min, max, step })` and
  the category factories (`createGeneralParams`, `createTransformParams`, `createRenderingParams`,
  or the light variants). Include `general: createGeneralParams("<Name>", "<description>")` and a
  `rendering` category where relevant. Every parameter needs a `displayName`.
- `<name>NodeComputeTyped(params, inputs, context): Record<string, BaseContainer>` - the
  authoritative compute. Read params as `params.<category>.<key>`. For an input-consuming node,
  read `inputs.default as <SomeContainer>` and clone it before mutating (nodes run
  `InputCloneMode.NEVER`). Return the primary output as `{ default: container }`. Import
  `ComputeContext` from `../../../engine/graphStore` (match the template's relative path).
- `<Name>NodeData` - the data type for the React Flow node (follow the template; geometry nodes
  extend the geometry data base).

Leave a clear `TODO` in the compute body if the geometry/logic is not yet designed, and hand it to
`/node`.

### 2. `src/flow/nodes/<Category>/<Name>Node.tsx`

The React Flow component. Default-export `<Name>Node(props: NodeProps)`; cast
`props.data as <Name>NodeData`; render on `BaseGeometryNodeDesign` (geometry) or `BaseNodeDesign`
(other), following the template. Expose each port with an `IOHandle` typed by its `ConnectionType`,
colored from `CONNECTION_COLORS` (never a hardcoded color). Match the template's handle ids and
positions.

### 3. `src/flow/nodes/index.ts`

Re-export the params, the compute function, and the data type, and add the node to its grouped
bundle object (`geometryNodes`, `modifierNodes`, `lightNodes`, `importNodes`, `utilityNodes`),
matching how the template node is exported.

### 4. `src/flow/nodes/nodeRegistry.ts`

Add the registry entry:

```ts
<name>Node: {
  type: "<name>Node",
  category: "<Category>",
  displayName: "<Name>",
  allowedContexts: ["subflow"],        // primitives/modifiers/imports; lights + geoNode are ["root"]; note is both
  params: <name>NodeParams,
  computeTyped: <name>NodeComputeTyped,
  inputCloneMode: InputCloneMode.NEVER, // primitives/modifiers/imports; omit for lights/geoNode/note
},
```

Keep the `type` string identical everywhere (here, the `nodeTypes` map, and the component). Use the
category-correct `allowedContexts` and `inputCloneMode`.

### 5. `src/constants/index.ts`

Map the `type` string to the imported React component in the `nodeTypes` object
(`<name>Node: <Name>Node`).

## Verify

1. `npm run lint` (ESLint at `--max-warnings 0`, so any warning fails) and `npm run build`
   (`tsc -b` then `vite build`) must both pass clean.
2. Hand the compute logic and the clone/`getContentHash` correctness to `/node` (node-author) for
   review, and coordinate with `/eng` (graph-engine-engineer) if you added a new Container type.
3. Ask `/qa` (qa-verifier) to confirm in the running app that the node appears in the palette (fuzzy
   search), can be added in its allowed context, connects on the right port types, and renders its
   output in the viewport.

## Common silent failures to check

- No `computeTyped` (only legacy `compute`): the scheduler produces no output. Geometry and modifier
  nodes must have `computeTyped`.
- The `type` string differs between the registry, the `nodeTypes` map, and the component: React Flow
  cannot render it.
- Wrong `allowedContexts` for the category: the palette will not offer it where expected.
- Mutating `inputs.default` in place under `InputCloneMode.NEVER`: corrupts upstream data. Clone
  first.
- A parameter missing `displayName`, or a default outside its own min/max.
