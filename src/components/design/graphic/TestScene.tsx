import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

const TestScene = () => {
  const meshRef = useRef<Mesh>(null!);
  useFrame(() => {
    meshRef.current.rotation.x += 0.01;
  });

  return (
    <>
      <mesh ref={meshRef} rotation={[0, 0, 0]}>
        <torusKnotGeometry args={[1, 0.4, 16, 100]} />
        <meshBasicMaterial color="mediumpurple" wireframe={false} />
      </mesh>
    </>
  );
};

export default TestScene;
