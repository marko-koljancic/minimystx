# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start development server (Vite + React)
- `npm run build` - TypeScript compilation and production bundle
- `npm run build-core` - Compile Rust WebAssembly modules to `src/wasm/pkg/`
- `npm run build-all` - Complete build: WebAssembly + TypeScript bundle
- `npm run lint` - Run ESLint with TypeScript rules
- `npm run preview` - Preview production build

### Prerequisites for Development
- Install Rust and wasm-pack before first build
- Run `npm run build-core` after any changes to `src/wasm/src/`
- WebAssembly modules are essential for 3D geometry processing

## Architecture Overview

### Core System Design
Minimystx is a browser-based parametric design studio with a split-pane interface combining a React Flow node editor with a Three.js 3D viewport. The architecture centers around a reactive computation graph where nodes represent 3D operations and edges represent data flow.

### Key Architectural Components

#### 1. Computation Engine (`src/engine/`)
- **Node Registry** (`nodeRegistry.ts`): Central registry of all available node types with their compute functions, default parameters, and metadata
- **Graph Store** (`graphStore.ts`): Zustand-based state management for the computation graph, handles node lifecycle, edge connections, and reactive updates
- **Compute Engine** (`computeEngine.ts`): Topological sorting, cycle detection, and dependency resolution for efficient graph evaluation
- **Connection Validation** (`connectionValidation.ts`): Ensures graph integrity and prevents cycles

#### 2. Node System (`src/flow/nodes/`)
Each node type follows a consistent pattern:
- **Processor Function**: Pure computation function that takes node data and optional input objects
- **Node Component**: React component for node UI in the flow editor
- **Type Definitions**: TypeScript interfaces for node data structures

Available node categories:
- **Geometry**: Box, Sphere, Cylinder, Cone, Plane, Torus, TorusKnot (primitive generators)
- **Import**: ImportObj (external geometry loading)
- **Modifiers**: Transform (translation, rotation, scale operations)

#### 3. 3D Rendering (`src/rendering/`)
- **Scene Manager** (`SceneManager.ts`): Three.js scene lifecycle management
- **Rendering Canvas** (`RenderingCanvas.tsx`): React Three Fiber integration for hardware-accelerated rendering

#### 4. State Management
- **Graph Store** (`src/store/`): Computation graph state with reactive updates
- **UI Store** (`src/store/uiStore.ts`): Persistent UI preferences (theme, layout, viewport settings)

#### 5. WebAssembly Integration (`src/wasm/`)
- Rust codebase compiled to WebAssembly for performance-critical geometry operations
- Build target: `src/wasm/pkg/minimystx-core-wasm/`
- Use `wasm-pack` for compilation

### Data Flow Architecture
1. **Node Creation**: Registered in nodeRegistry with compute function and default parameters
2. **Graph Updates**: Managed by graphStore with dependency tracking
3. **Computation**: Triggered reactively on parameter changes or connection updates
4. **Rendering**: Three.js objects created from node outputs and rendered in real-time

### Development Patterns

#### Adding New Node Types
1. Create processor function in `src/flow/nodes/[NodeName].ts`
2. Create React component `[NodeName]Node.tsx` 
3. Register node in `src/engine/nodeRegistry.ts` with type, category, defaults, and compute function
4. Export from appropriate index files

#### Node Processor Pattern
```typescript
export const processor = (data: NodeData, inputObject?: Object3D) => {
  // Create Three.js geometry/object based on data parameters
  // Apply transformations and materials
  // Return { object: Object3D, geometry?: BufferGeometry }
};
```

#### Graph Store Integration
- Use `addNode(NodeInitData)` for new nodes
- Use `setParams(nodeId, params)` for parameter updates
- Use `addEdge(source, target)` for connections
- Store automatically handles dependency updates and recomputation

### Key Technical Constraints
- All geometry processing must be serializable for the computation graph
- Node compute functions must be pure (no side effects)
- Three.js objects are recreated on parameter changes for consistency
- WebAssembly modules handle computationally intensive operations

### File Structure Conventions
- Node implementations in `src/flow/nodes/[Category]/`
- Common UI components in `src/common/`
- Engine components are framework-agnostic TypeScript
- React components use CSS modules for styling
- Hooks for React integration in `src/hooks/`