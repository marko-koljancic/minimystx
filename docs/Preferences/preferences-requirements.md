Here’s a reformatted and enhanced version of your **Preferences options requirements**, structured for clarity and easier consumption by engineers, QA, and designers. I’ve tightened language, standardized headings, and emphasized key rules/behaviors.

---

# Task: Implement **Edit → Preferences** Modal (Tabbed)

## Goal

Introduce a global **Preferences** modal accessible via *Edit → Preferences*.
Preferences affect **renderer behavior, evaluation performance, units, grid, overlays, and screenshot capture**.
Users can scope settings to either **Global Default** or **This Project Only**.

---

## Scope

* New modal UI: centered, fixed width with responsive height; tab content scrollable.
* State management: use existing patterns (Zustand), reusing store logic where possible.
* Non-destructive: changing units or quality presets never rewrites stored scene values.
* Preferences persist immediately on change (with **Restore Defaults** per tab and a global **Reset All**).
* Behavior/structure only (no scaffolding code required).

---

## Entry Points

* **Header menu**: *Edit → Preferences*
* Closing: Esc, Cancel button, or outside click (respect current modal policy)
* Opening hotkey: Cmd+, (macOS) / Ctrl+, (Windows/Linux)

---

## Modal Layout

* **Title**: *Preferences*
* **Tabs**: horizontal, styled like the Parameters panel
* **Content area**: grouped sections, fields with tooltips
* **Footer buttons** (bottom right):

  * \[Cancel] → Discards unsaved changes in session
  * \[Apply] → Saves but keeps modal open
  * \[OK] → Saves and closes modal

**Live updates**: Controls that affect renderer safely should preview immediately. Unsafe changes apply only on Apply/OK.

---

## Tabs & Fields

### 1. Units

Decouple engine (meters) from UI display.

* Base unit: read-only, “Engine stores meters (m)”
* Display unit (dropdown): mm, cm, m \[default], in, ft, ft-in

---

### 2. Renderer

Quality and performance presets.

* **Quality preset**: Low, Balanced \[default], High, Custom

  * Preset changes update dependent fields; Custom preserves overrides
* Antialiasing: None, FXAA \[default], MSAA, TAA (if supported)
* Pixel ratio cap: slider \[1.0 → devicePixelRatio], default 2.0
* VSync / FPS cap: Off, 30, 60 \[default], 120
* **Post-processing**

  * Enable toggle \[off default]
  * Active passes (multi-select, ordered): Bloom, SSAO, ToneMapping
* Background: Single color or two-color gradient

---

### 3. Materials & Tone Mapping

* Default material: MeshStandard (editable defaults)
* Tone mapping: None, Linear, Reinhard, ACESFilmic \[default]
* Exposure: \[1.0 default]
* Encoding: sRGB \[on default]

---

### 4. Camera & Viewport

* Default camera: Perspective \[default] or Orthographic
* Perspective FOV: 50° \[default]
* Ortho scale: 10 \[default]
* Clipping planes: Near \[0.1], Far \[1000]
* **Orbit controls**: rotate speed, pan speed, dolly speed (all 1.0 default)

  * Damping \[on]
  * Focus on selection \[on], Frame padding \[0.1]

---

### 5. Guides

* Grid display \[on default]

  * Major spacing: 1.0 (in display units)
  * Minor subdivisions: 10
  * Opacity: numeric (default from theme)
* Axis gizmo: on \[default], size (small \[default], medium, large)
* Ground plane: off \[default], with shadow toggle (active only if ground enabled)

---

### 6. Screenshot Capture

* **Capture area**: Entire viewport \[default], Selection-fit, Custom region
* **Camera source**: Active \[default] or pick from scene list
* **Resolution**:

  * Presets: Viewport, 1.5x, 2x \[default], 4x, Custom (WxH fields)
  * Respect device pixel ratio \[off default]
* **File format**: PNG \[default], JPEG, WEBP

  * JPEG/WEBP expose quality slider \[0.9 default]
  * Transparent background \[off default]
* **Overlays**: grid, gizmos, stats (all off default)
* **Color management**: sRGB embed \[on], Tone mapping bake \[on]
* **File naming**: Template: `minimystx-screenshot-{date}-{time}-{width}x{height}.png`

  * Post-action: Save \[default], Copy to clipboard, Open in new tab
  * Embed metadata \[on default]: scene, camera, FOV, scale, version
* **Capture flow**: countdown (Off \[default], 3s, 5s), restore viewport \[on default]
* **Presets**:

  * Documentation (PNG, overlays off, metadata on)
  * Shareable (JPEG/WebP, smaller, overlays on)
  * Custom user presets

---

### 7. Debug & Developer

* Renderer info panel \[off default]
* Log level: Errors, Warnings \[default], Verbose
* Show normals/tangents \[off default]
* Reveal internal meters in tooltips \[on default]

---

## Common Behaviors

* **Restore Defaults** → per-tab reset only
* **Reset All** → restores app-wide defaults
* **Scope** → “Project Only” vs “Global Default” (tabs: Units, Renderer, Guides, Screenshot)
* Preferences persist across reloads; project and global stored separately

---

## UX & Accessibility

* Tab focus order matches visual order
* Each field has tooltip (impact & performance note)
* Respect dark theme tokens
* Cancel always reverts unsaved changes (never destructive)

---

## Acceptance Criteria

1. Preferences modal opens via Edit menu or hotkey
2. Defaults match table above; presets update dependent fields
3. Display unit changes affect UI only, not engine values
4. Grid/gizmos respect chosen units and increments
5. Screenshot captures respect all capture options (area, resolution, overlays, metadata, etc.)
6. Per-tab “Restore Defaults” and global “Reset All” function correctly
7. Scope persistence works without cross-contamination (project vs global)
8. State persists across reloads
9. Invalid inputs handled safely, no runtime errors

---

## Future (Not in Scope)

* Overlays & HUD (selection outlines, wireframe, bounding boxes, stats overlay)
* Interaction & Gizmos (snap overrides, gizmo styles, transparent select)
* Evaluation & Compute (strategy, recompute modes, task concurrency limits)

---

## Persistence Schema (versioned)

Top-level keys (for migrations):

```
preferences.version
preferences.scope
preferences.units
preferences.renderer
preferences.materials
preferences.camera
preferences.grid
preferences.screenshot
preferences.debug
preferences.overlays (future)
preferences.interaction (future)
preferences.compute (future)
```

---

## Validation Rules

* Numeric inputs clamped; invalid → revert on blur
* Mutually exclusive options hide/show dependencies
* Quality preset reverts to **Custom** if manual tweaks are made

---

