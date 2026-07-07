---
name: scaffold-node
description: >-
  Scaffold a new Minimystx node type across its three wiring files, using an existing node as the
  template. Use when the user wants to add a new node (primitive, modifier, import, light, or
  utility) to the node editor, or asks to "add a node", "scaffold a node", "create a new
  primitive/modifier/light", or similar. Handles the mechanical 3-file wiring; hand the compute
  logic to the node-author (/node) for design and review.
---

# Scaffold a Minimystx node type

A node in Minimystx is wired across three files. Missing one, or misnaming a port, makes the node
fail silently: it will not appear in the palette, will not render, or will connect but receive no
input. This skill walks all three, using the closest existing node as the template. It does the
mechanical wiring; the compute logic and port/parameter design should be filled and reviewed by the
node-author agent (`/node`).

There is NO per-node React component and NO `constants/index.ts` edit anymore: one generic
`src/flow/FlowNode.tsx` renders every node type from its registry entry (label, render-flag badge,
compute error/warning badge, and handles from the declared ports), and `nodeTypes` is derived from
the registry. The Note node is the only bespoke component.

## Before you start

1. Confirm the essentials with the user (or infer from the request and state your assumptions):
   - Node name (for example `Cylinder2`) and category. Existing categories: `3D Primitives`,
     `Modifiers`, `Import`, `Lights`, `Container`, `Utility`. Folders live under `src/flow/nodes/`.
   - Its inputs (ports it consumes) and outputs (ports it produces), each a `ConnectionType`. Port
     names matter: a port `name` IS the React Flow handle id AND the key `computeTyped` reads from
     its `inputs` record.
   - Its parameters, each with a type, a `displayName`, and a sensible default and range.
2. Open the closest existing node as your template and copy its shape rather than inventing one:
   - A geometry primitive: `src/flow/nodes/3D_Primitives/Box.ts`.
   - An input-consuming modifier: `src/flow/nodes/Modifiers/Transform.ts`.
   - A light: `src/flow/nodes/Lights/PointLight.ts` (returns `{ default: new Object3DContainer(light) }`).
3. Read `CLAUDE.md` "Adding a new node type", `src/engine/nodeParameterFactories.ts`, and
   `src/engine/containers/BaseContainer.ts` so you use the real param and container APIs.

## The three files

### 1. `src/flow/nodes/<Category>/<Name>.ts`

Export three things:

- `<name>NodeParams: NodeParams` - a two-level object `{ category: { key: ParameterMetadata } }`.
  Build entries with `createParameterMetadata(type, default, { displayName, min, max, step })` and
  the category factories (`createGeneralParams`, `createTransformParams`, `createRenderingParams`,
  or the light variants). Include `general: createGeneralParams("<Name>", "<description>")` and a
  `rendering` category where relevant (declaring `rendering.visible` gives the node its render-flag
  badge). Every parameter needs a `displayName`.
- `<name>NodeComputeTyped(params, inputs?): NodeOutputs` - the compute. Read params as
  `params.<category>.<key>`. For an input-consuming node, read `inputs.default as <SomeContainer>`
  and clone it before mutating (inputs are shared by reference with the upstream output). Return the
  primary output as `{ default: container }`. Most nodes only need `params`; drop unused parameters
  (`noUnusedParameters` is on).
- `<Name>NodeData` - the data type (follow the template; geometry nodes extend the geometry data
  base).

Leave a clear `TODO` in the compute body if the geometry/logic is not yet designed, and hand it to
`/node`.

### 2. `src/flow/nodes/index.ts`

Re-export the params, the compute function, and the data type, matching how the template node is
exported (a plain `export { ... } from "./<Category>/<Name>"` plus the `export type`).

### 3. `src/flow/nodes/nodeRegistry.ts`

Add the registry entry, declaring the ports so `FlowNode` can render the handles:

```ts
<name>Node: {
  type: "<name>Node",
  category: "<Category>",
  displayName: "<Name>",
  allowedContexts: ["subflow"],   // primitives/modifiers/imports; lights + geoNode are ["root"]; note is both
  params: <name>NodeParams,
  computeTyped: <name>NodeComputeTyped,
  outputs: GEOMETRY_OUTPUT,        // reuse the shared port consts near the top of the file
  inputs: OBJECT_INPUT,            // only if the node consumes an input; omit for source-only nodes
},
```

Keep the `type` string identical between the registry key and the `type` field. Reuse the shared
port constants (`GEOMETRY_OUTPUT`, `OBJECT_INPUT`, `COMBINE_INPUTS`) defined at the top of the
registry, or declare new `NodeInput[]`/`NodeOutput[]` whose `name`s match your compute's input keys.

## Verify

1. `npm run lint` (ESLint at `--max-warnings 0`, so any warning fails), `npm run build`
   (`tsc -b` then `vite build`), and `npm test` (vitest) must all pass clean.
2. Hand the compute logic and the clone correctness to `/node` (node-author) for review, and
   coordinate with `/eng` (graph-engine-engineer) if you added a new Container type.
3. Ask `/qa` (qa-verifier) to confirm in the running app that the node appears in the palette (fuzzy
   search), can be added in its allowed context, connects on the right port types, and renders its
   output in the viewport.

## Common silent failures to check

- No `computeTyped`: the cook produces no output.
- A handle id / port name that does not match the key `computeTyped` reads from `inputs`: the node
  connects but receives nothing (the exact bug the declared-ports rule prevents).
- The registry key differs from the `type` field.
- Wrong `allowedContexts` for the category: the palette will not offer it where expected.
- Mutating `inputs.default` in place: corrupts upstream data. Clone first.
- A parameter missing `displayName`, or a default outside its own min/max.
