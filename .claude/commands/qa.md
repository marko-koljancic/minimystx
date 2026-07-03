---
description: Run the qa-verifier agent against the running studio (claude-in-chrome verification)
argument-hint: [Explore|Audit|Triage|Strategize|Explain] [target]
agent: qa-verifier
---

Verify the running studio via the claude-in-chrome browser. Ensure the Vite dev server is up first
(`npm run dev`; read the actual port from its output); start it if it is not. Load the
claude-in-chrome tools via ToolSearch first if they are deferred. Drive the real app, observe, and
report findings; make no app-code edits.

Mode and target from the arguments: $ARGUMENTS

Interpret the first token as the Mode if it is one of Explore, Audit, Triage, Strategize, or Explain
(default Audit); the remainder is the target. If no target is given, run the core compute-and-render
check (add a GeoNode at root, open its subflow, add a primitive, set it as the active output, return
to root, and confirm geometry renders in the viewport with a screenshot), plus console/network health
and the static gates (`npm run lint`, `npm run build`). Report findings and name the likely owner
agent for each fix.
