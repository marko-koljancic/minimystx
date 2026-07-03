import FlowCanvas from "../flow/FlowCanvas";
import RenderingCanvas from "../rendering/RenderingCanvas";
import DesignLayout from "./DesignLayout";
import ErrorBoundary from "../components/ErrorBoundary";
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
  return (
    <DesignLayout
      leftTop={
        <ErrorBoundary label="Viewport">
          <RenderingCanvas />
        </ErrorBoundary>
      }
      right={
        <ErrorBoundary label="Node editor">
          <FlowCanvas />
        </ErrorBoundary>
      }
    />
  );
}
