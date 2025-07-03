import { Canvas } from "@react-three/fiber";
import TestScene from "./TestScene";

const GraphicsCanvas = () => {
  return (
    <>
      <Canvas
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
        camera={{ position: [0, 0, 5], fov: 75 }}
      >
        <TestScene />
      </Canvas>
    </>
  );
};

export default GraphicsCanvas;
