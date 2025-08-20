# Minimystx

A browser-based parametric design studio built with React, TypeScript, and WebAssembly (Rust) for instant, high-performance 3D modeling.

## Overview

Minimystx is a browser-only parametric design studio that combines the power of React and TypeScript with Rust compiled to WebAssembly for high-performance operations. It's designed to open fast, feel instantaneous on a laptop GPU, and keep users in an unbroken flow of node editing with real-time 3D feedback. The application features a node-based editing system similar to Houdini/Grasshopper with a split interface showing both the node editor and 3D viewport simultaneously.

## Features

### User Experience

- Instant entry with minimal landing page and client-side navigation
- Split workspace with Three.js 3D viewport and React Flow node editor
- Node-based parametric design with real-time 3D feedback
- Intuitive port grammar with color-coded type system

### Technical Implementation

- React 19 + TypeScript frontend with React Router
- Rust WebAssembly backend for performance-critical operations
- Three.js with @react-three/fiber and @react-three/drei for hardware-accelerated 3D graphics
- @xyflow/react (formerly React Flow) for interactive node-based workflows
- Zustand for state management
- Vite for fast development and optimized builds
- Performance optimizations for smooth 60 FPS experience

### Design System

- Color-coded port types (Float, Integer, Vector3, Geometry, Material, Light)
- Streamlined node workflow with hover enlargement and inline controls
- Collapsible node palette
- Advanced interaction patterns (space+drag to pan, F to frame, A for auto-layout)
- Responsive visual feedback with magnetized connections and hover highlights

### Supported Nodes

#### Primitive Geometry

- Box - Create parametric box/cube geometry
- Sphere - Create parametric sphere geometry
- Cylinder - Create parametric cylinder geometry
- Cone - Create parametric cone geometry
- Plane - Create parametric plane geometry
- Torus - Create parametric torus (donut) geometry
- TorusKnot - Create parametric torus knot geometry

#### Import Geometry

- ImportObj - Import OBJ file format geometry

#### Transformations

- Transform - Apply translation, rotation, and scale to geometry

### Keyboard Shortcuts

#### Flow Canvas

- `G` - Toggle grid visibility in flow canvas
- `M` - Toggle minimap visibility
- `C` - Toggle flow controls visibility
- `S` - Cycle through connection line styles
- `F` - Fit nodes to view

#### 3D Viewport

- `G` - Toggle grid visibility in 3D viewport
- `W` - Toggle wireframe mode
- `X` - Toggle x-ray mode
- `F` - Fit view to geometry

#### Global

- Space+drag - Pan the canvas
- Mouse wheel - Zoom in/out

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- Rust and Cargo (for WebAssembly compilation)
- wasm-pack (for building WebAssembly modules)
- Modern browser with WebGL support

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/marko-koljancic/minimystx.git
   cd minimystx
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the WebAssembly core:

   ```bash
   npm run build-core
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Build

To build the complete project for production:

```bash
npm run build-all
```

This will:

1. Build the WebAssembly components with `build-core`
2. Compile TypeScript files and bundle the application with Vite using `build`

You can also run these steps separately:

```bash
npm run build-core  # Build WebAssembly components only
npm run build       # Build TypeScript and bundle with Vite only
```

## Project Structure

```plaintext
minimystx/
├── src/
│   ├── App.tsx         # Main application component
│   ├── main.tsx        # Application entry point
│   ├── assets/         # Asset files (models, IFC samples)
│   ├── common/         # Common UI components
│   ├── components/     # Reusable React components
│   ├── constants/      # Application constants
│   ├── engine/         # Core application engine
│   │   ├── computeEngine.ts      # Computation engine
│   │   ├── connectionValidation.ts # Connection validation logic
│   │   ├── graphStore.ts         # Graph state management
│   │   └── nodeRegistry.ts       # Node type registry
│   ├── flow/           # Flow editor components
│   │   ├── edges/      # Edge components for connections
│   │   └── nodes/      # Node definitions and components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── panels/         # Panel UI components
│   ├── rendering/      # 3D rendering components
│   │   ├── RenderingCanvas.tsx   # Canvas component
│   │   └── SceneManager.ts       # Three.js scene management
│   ├── store/          # State management
│   ├── styles/         # CSS styles
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── wasm/           # Rust WebAssembly code
│       ├── src/        # Rust source code
│       └── pkg/        # WebAssembly compiled output
├── public/             # Static assets
└── docs/               # Documentation
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build TypeScript and bundle with Vite
- `npm run build-core` - Build WebAssembly components
- `npm run build-all` - Build both WebAssembly components and TypeScript bundle
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## License

[MIT License](LICENSE)

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Contact

[Marko Koljancic](https://koljam.com/)
