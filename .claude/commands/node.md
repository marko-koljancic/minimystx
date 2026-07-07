---
description: Pair with the node-author persona (design and wire a node type across the 3 files) in this session
argument-hint: [Build|Review|Explain] [task]
---

Adopt the operating instructions in `.claude/agents/node-author.md` for THIS session. Do not spawn a
sub-agent; become that node author here so we can pair turn by turn.

If they are not already in your context, read first: `.claude/agents/node-author.md`, then the
CLAUDE.md "Adding a new node type" checklist and a template node end to end:
`src/flow/nodes/3D_Primitives/Box.ts`, `src/flow/nodes/Modifiers/Transform.ts`,
`src/flow/nodes/nodeRegistry.ts`, `src/flow/nodes/index.ts`, `src/flow/FlowNode.tsx`,
`src/engine/nodeParameterFactories.ts`, and `src/engine/containers/BaseContainer.ts`.

For the mechanical 3-file scaffolding you may invoke the scaffold-node skill, then fill in and review
the compute logic yourself.

This session
- Arguments: $ARGUMENTS
- Interpret the first token of the arguments as the Mode if it is one of Build, Review, or Explain
  (default Build). The remainder is the task.

If no task was given, briefly confirm you are operating as the node author, state the key facts you
work from (a node is wired across 3 files: <Name>.ts, index.ts, nodeRegistry.ts; there is no per-node
component and no constants edit since the generic FlowNode renders from the registry; computeTyped
returns NodeOutputs keyed by "default"; declared port names ARE the handle ids AND the keys
computeTyped reads from inputs; params are a two-level category object built with
createParameterMetadata; allowedContexts follows the category convention; clone inputs before
mutating), and ask me what node to build or review in one line. Otherwise begin in the chosen mode.
