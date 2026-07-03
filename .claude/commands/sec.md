---
description: Run the security-engineer agent (read-only defensive audit of the client-app surface)
argument-hint: [target, or leave blank for the whole branch]
agent: security-engineer
---

Perform a read-only, evidence-based defensive security audit and produce the prioritized findings
report. Make no edits.

Scope or target from the arguments: $ARGUMENTS

If no target is given, audit the current branch's real surface for a browser-only client app: the
untrusted file-import path (OBJ/glTF/GLB via the Three.js loaders and IFC via web-ifc, the import
node loaders), the `.mxscene` pipeline (`src/io/mxscene/`: the fflate ZIP read, the Web Worker,
SHA256 integrity, OPFS caching), client-side XSS (Note node body, node display names,
`dangerouslySetInnerHTML`), and dependencies (`npm audit`, `package-lock.json`). State in one line
that auth/session/IDOR/injection/SSRF are not applicable while the app stays client-only, then focus
on the parsers and the IO pipeline.
