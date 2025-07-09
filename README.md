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
- Global undo/redo and persistent autosave

### Technical Implementation

- React + TypeScript frontend with React Router
- Rust WebAssembly backend for performance-critical operations
- React Three Fiber integration for hardware-accelerated 3D graphics
- React Flow for interactive node-based workflows
- Performance optimizations for smooth 60 FPS experience

### Design System

- Color-coded port types (Float, Integer, Vector3, Geometry, Material, Light)
- Streamlined node workflow with hover enlargement and inline controls
- Collapsible node palette and command palette (⌘/Ctrl + K)
- Advanced interaction patterns (space+drag to pan, F to frame, A for auto-layout)
- Responsive visual feedback with magnetized connections and hover highlights

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
   npm run core-build
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Build

To build the project for production:

```bash
npm run build
```

This will:

1. Compile TypeScript files
2. Build the WebAssembly components
3. Bundle the application with Vite

## Project Structure

```plaintext
minimystx/
├── src/
│   ├── components/     # Reusable React components
│   │   ├── design/     # Design mode components
│   │   │   ├── flow/   # React Flow node editor
│   │   │   │   └── nodes/  # Node type definitions
│   │   │   └── graphic/    # Three.js 3D viewport
│   ├── pages/          # Page components
│   │   ├── Home.tsx    # Landing page
│   │   ├── Design.tsx  # Design studio page
│   │   └── NotFound.tsx # 404 page
│   ├── core/           # Rust WebAssembly code
│   │   └── wasm-engine/    # WASM performance-critical operations
│   ├── layouts/        # Layout components
│   ├── pkg-build/      # WebAssembly compiled output
│   ├── store/          # State management
│   └── styles/         # CSS styles
├── public/             # Static assets
└── docs/               # Documentation
```

## Development

- `npm run dev` - Start development server
- `npm run core-build` - Build WebAssembly components
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

Project Link: [https://github.com/marko-koljancic/minimystx](https://github.com/marko-koljancic/minimystx)
