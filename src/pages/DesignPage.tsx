import FlowCanvas from "../flow/FlowCanvas";
import RenderingCanvas from "../rendering/RenderingCanvas";
import DesignLayout from "./DesignLayout";
import { ReactFlowProvider } from "@xyflow/react";

export default function DesignPage() {
  return (
    <>
      <ReactFlowProvider>
        <DesignPageContent />
      </ReactFlowProvider>
    </>
  );
}

function DesignPageContent() {
  return <DesignLayout leftTop={<RenderingCanvas />} right={<FlowCanvas />} />;
}
