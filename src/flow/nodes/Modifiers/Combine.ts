import { Object3D, Group } from "three";
import type { GeneralProps, RenderingProps } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";

export interface CombineNodeData extends Record<string, unknown> {
  general: GeneralProps;
  rendering: RenderingProps;
}

const combineObjects = (inputObjects: Array<Object3D | undefined>): Group => {
  const group = new Group();

  inputObjects.forEach((inputObject, index) => {
    if (inputObject) {
      const childGroup = new Group();
      childGroup.name = `input${index + 1}`;
      // Force the consumed input visible: an input node is typically not the active
      // output, so its own mesh may carry visible=false, which must not hide it once
      // it is combined here.
      const clone = inputObject.clone(true);
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

  return group;
};

export const combineNodeParams: NodeParams = {
  general: createGeneralParams("Combine", "Combines up to four geometry inputs into a single output"),
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};

export const combineNodeComputeTyped = (
  _params: Record<string, unknown>,
  inputs: Record<string, BaseContainer>
): Record<string, BaseContainer> => {
  const inputContainers = [
    inputs.input1 as Object3DContainer | undefined,
    inputs.input2 as Object3DContainer | undefined,
    inputs.input3 as Object3DContainer | undefined,
    inputs.input4 as Object3DContainer | undefined,
  ];

  const group = combineObjects(inputContainers.map((container) => container?.value));

  return { default: new Object3DContainer(group) };
};
