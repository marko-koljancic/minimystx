import { Object3D, Group } from "three";
import type { GeneralProps, RenderingProps, NodeProcessor } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";

export interface CombineNodeData extends Record<string, unknown> {
  general: GeneralProps;
  rendering: RenderingProps;
}

export const processor: NodeProcessor<CombineNodeData, { object: Object3D }> = (
  _data: CombineNodeData,
  input1?: { object: Object3D },
  input2?: { object: Object3D },
  input3?: { object: Object3D },
  input4?: { object: Object3D }
): { object: Object3D } => {
  const group = new Group();

  const inputs = [input1, input2, input3, input4];

  inputs.forEach((input, index) => {
    if (input?.object) {
      const childGroup = new Group();
      childGroup.name = `input${index + 1}`;
      // Force the consumed input visible: an input node is typically not the active
      // output, so its own mesh may carry visible=false, which must not hide it once
      // it is combined here.
      const clone = input.object.clone(true);
      clone.visible = true;
      clone.traverse((child) => {
        child.visible = true;
      });
      childGroup.add(clone);
      group.add(childGroup);
    }
  });

  // Visibility as the active output is gated by SceneObjectManager, not baked here,
  // so a Combine consumed by another node (nested) is not hidden.
  group.visible = true;

  return { object: group };
};

export const combineNodeParams: NodeParams = {
  general: createGeneralParams("Combine", "Combines up to four geometry inputs into a single output"),
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};

export const combineNodeCompute = (params: Record<string, any>, inputs: Record<string, any>) => {
  const inputKeys = ["input1", "input2", "input3", "input4"];
  const inputObjects: Array<{ object: Object3D } | undefined> = [];

  inputKeys.forEach((key) => {
    const input = inputs[key];
    if (input && typeof input === "object" && (input as any).object && (input as any).object.isObject3D) {
      inputObjects.push(input as { object: Object3D });
    } else {
      inputObjects.push(undefined);
    }
  });

  const data: CombineNodeData = {
    general: params.general || {},
    rendering: {
      visible: params.rendering?.visible !== false,
      ...params.rendering,
    },
  };

  return processor(data, inputObjects[0], inputObjects[1], inputObjects[2], inputObjects[3]);
};

export const combineNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const inputContainers = [
    inputs.input1 as Object3DContainer | undefined,
    inputs.input2 as Object3DContainer | undefined,
    inputs.input3 as Object3DContainer | undefined,
    inputs.input4 as Object3DContainer | undefined,
  ];

  const data: CombineNodeData = {
    general: params.general || {},
    rendering: {
      visible: params.rendering?.visible !== false,
      ...params.rendering,
    },
  };

  const inputObjects = inputContainers.map((container) => (container ? { object: container.value } : undefined));

  const result = processor(data, inputObjects[0], inputObjects[1], inputObjects[2], inputObjects[3]);

  return { default: new Object3DContainer(result.object) };
};
