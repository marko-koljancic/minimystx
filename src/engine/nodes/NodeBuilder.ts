/**
 * NodeBuilder - Fluent API for atomic node plugin development
 * 
 * Provides a standardized way to create nodes with proper input/output 
 * definitions, type checking, and automatic integration with the 
 * Minimystx engine systems.
 */

import { ConnectionType, NodeInput, NodeOutput, InputHelpers, OutputHelpers } from '../types/NodeIO';
import { BaseContainer } from '../containers/BaseContainer';
import { NodeDefinition, NodeParams } from '../graphStore';
import { createParameterMetadata } from '../parameterUtils';

export interface ComputeFunction {
  (
    params: Record<string, any>,
    inputs: Record<string, BaseContainer>,
    context: ComputeContext
  ): Promise<Record<string, BaseContainer>> | Record<string, BaseContainer>;
}

export interface ComputeContext {
  nodeId: string;
  renderTarget: string | null;
  isInRenderCone: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Fluent API for building node definitions
 */
export class NodeBuilder {
  private _type: string = '';
  private _category: string = '';
  private _displayName: string = '';
  private _description: string = '';
  private _inputs: NodeInput[] = [];
  private _outputs: NodeOutput[] = [];
  private _params: NodeParams = {};
  private _computeFunction: ComputeFunction | null = null;
  private _allowedContexts: ("root" | "subflow")[] = ["root", "subflow"];

  /**
   * Set node type identifier
   */
  type(type: string): NodeBuilder {
    this._type = type;
    return this;
  }

  /**
   * Set node category for organization
   */
  category(category: string): NodeBuilder {
    this._category = category;
    return this;
  }

  /**
   * Set display name and description
   */
  display(name: string, description?: string): NodeBuilder {
    this._displayName = name;
    if (description) {
      this._description = description;
    }
    return this;
  }

  /**
   * Add typed input port
   */
  input(input: NodeInput): NodeBuilder;
  input(name: string, type: ConnectionType, required?: boolean, defaultValue?: any): NodeBuilder;
  input(
    nameOrInput: string | NodeInput,
    type?: ConnectionType,
    required = true,
    defaultValue?: any
  ): NodeBuilder {
    if (typeof nameOrInput === 'string') {
      const input: NodeInput = {
        name: nameOrInput,
        type: type!,
        required,
        defaultValue,
        description: `${nameOrInput} input`
      };
      this._inputs.push(input);
    } else {
      this._inputs.push(nameOrInput);
    }
    return this;
  }

  /**
   * Add typed output port
   */
  output(output: NodeOutput): NodeBuilder;
  output(name: string, type: ConnectionType): NodeBuilder;
  output(nameOrOutput: string | NodeOutput, type?: ConnectionType): NodeBuilder {
    if (typeof nameOrOutput === 'string') {
      const output: NodeOutput = {
        name: nameOrOutput,
        type: type!,
        description: `${nameOrOutput} output`
      };
      this._outputs.push(output);
    } else {
      this._outputs.push(nameOrOutput);
    }
    return this;
  }

  /**
   * Add parameter category
   */
  parameterCategory(categoryName: string, params: Record<string, any>): NodeBuilder {
    this._params[categoryName] = params;
    return this;
  }

  /**
   * Add single parameter (convenience method)
   */
  parameter(
    categoryName: string,
    paramName: string,
    type: "number" | "boolean" | "string" | "vector2" | "vector3" | "vector4" | "color" | "enum" | "file",
    defaultValue: any,
    options?: {
      displayName?: string;
      min?: number;
      max?: number;
      step?: number;
      enumValues?: string[];
      accept?: string;
    }
  ): NodeBuilder {
    if (!this._params[categoryName]) {
      this._params[categoryName] = {};
    }
    
    this._params[categoryName][paramName] = createParameterMetadata(type, defaultValue, options);
    return this;
  }

  /**
   * Set computation function
   */
  compute(computeFunction: ComputeFunction): NodeBuilder {
    this._computeFunction = computeFunction;
    return this;
  }

  /**
   * Set allowed contexts for this node
   */
  contexts(contexts: ("root" | "subflow")[]): NodeBuilder {
    this._allowedContexts = contexts;
    return this;
  }

  /**
   * Build the final node definition
   */
  build(): NodeDefinition & { inputs: NodeInput[]; outputs: NodeOutput[] } {
    if (!this._type) {
      throw new Error('Node type is required');
    }
    
    if (!this._computeFunction) {
      throw new Error('Compute function is required');
    }

    // Legacy compute function for backwards compatibility
    const legacyCompute = async (params: Record<string, any>) => {
      // Create empty inputs for legacy compatibility
      const emptyInputs: Record<string, BaseContainer> = {};
      const context: ComputeContext = {
        nodeId: '',
        renderTarget: null,
        isInRenderCone: true
      };

      const result = await this._computeFunction!(params, emptyInputs, context);
      
      // Return first output for legacy compatibility
      const firstOutput = Object.values(result)[0];
      return firstOutput?.value || null;
    };

    return {
      type: this._type,
      category: this._category,
      displayName: this._displayName || this._type,
      allowedContexts: this._allowedContexts,
      params: this._params,
      inputs: this._inputs,
      outputs: this._outputs,
      compute: legacyCompute,
      computeTyped: this._computeFunction,
      description: this._description
    } as NodeDefinition & { inputs: NodeInput[]; outputs: NodeOutput[] };
  }

  /**
   * Validate the node definition
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this._type) errors.push('Node type is required');
    if (!this._displayName) errors.push('Display name is required');
    if (!this._computeFunction) errors.push('Compute function is required');
    
    // Validate input names are unique
    const inputNames = new Set();
    this._inputs.forEach(input => {
      if (inputNames.has(input.name)) {
        errors.push(`Duplicate input name: ${input.name}`);
      }
      inputNames.add(input.name);
    });

    // Validate output names are unique
    const outputNames = new Set();
    this._outputs.forEach(output => {
      if (outputNames.has(output.name)) {
        errors.push(`Duplicate output name: ${output.name}`);
      }
      outputNames.add(output.name);
    });

    return errors;
  }
}

/**
 * Factory functions for common node patterns
 */
export const NodePatterns = {
  /**
   * Geometry generator pattern (no inputs, geometry output)
   */
  geometryGenerator(type: string, displayName: string): NodeBuilder {
    return new NodeBuilder()
      .type(type)
      .category('Geometry')
      .display(displayName)
      .output(OutputHelpers.geometry())
      .output(OutputHelpers.object3d());
  },

  /**
   * Geometry modifier pattern (geometry input, geometry output)
   */
  geometryModifier(type: string, displayName: string): NodeBuilder {
    return new NodeBuilder()
      .type(type)
      .category('Geometry')
      .display(displayName)
      .input(InputHelpers.geometry())
      .output(OutputHelpers.geometry())
      .output(OutputHelpers.object3d());
  },

  /**
   * Math operation pattern (number inputs, number output)
   */
  mathOperation(type: string, displayName: string, inputCount = 2): NodeBuilder {
    const builder = new NodeBuilder()
      .type(type)
      .category('Math')
      .display(displayName)
      .output(OutputHelpers.number('result'));

    // Add number inputs
    for (let i = 0; i < inputCount; i++) {
      const inputName = inputCount === 1 ? 'value' : `value${i + 1}`;
      builder.input(InputHelpers.number(inputName, 0, false));
    }

    return builder;
  },

  /**
   * Utility node pattern (any input, any output)
   */
  utility(type: string, displayName: string): NodeBuilder {
    return new NodeBuilder()
      .type(type)
      .category('Utility')
      .display(displayName);
  }
};

/**
 * Helper to register a built node with the engine
 */
export function registerNode(nodeDefinition: NodeDefinition & { inputs: NodeInput[]; outputs: NodeOutput[] }) {
  // This would integrate with the existing nodeRegistry
  // For now, return the definition to be manually registered
  return nodeDefinition;
}

/**
 * Example usage and testing
 */
export const ExampleNodes = {
  /**
   * Example: Simple box generator node
   */
  createBoxNode(): NodeDefinition & { inputs: NodeInput[]; outputs: NodeOutput[] } {
    return NodePatterns.geometryGenerator('box', 'Box')
      .parameterCategory('geometry', {
        width: createParameterMetadata('number', 1, { min: 0.01, max: 100, step: 0.1 }),
        height: createParameterMetadata('number', 1, { min: 0.01, max: 100, step: 0.1 }),
        depth: createParameterMetadata('number', 1, { min: 0.01, max: 100, step: 0.1 })
      })
      .compute(async (_params, _inputs, _context) => {
        // Implementation would go here
        // This is just a placeholder
        throw new Error('Example node - not implemented');
      })
      .build();
  },

  /**
   * Example: Transform modifier node
   */
  createTransformNode(): NodeDefinition & { inputs: NodeInput[]; outputs: NodeOutput[] } {
    return NodePatterns.geometryModifier('transform', 'Transform')
      .input(InputHelpers.vector3('translation', { x: 0, y: 0, z: 0 }, false))
      .input(InputHelpers.vector3('rotation', { x: 0, y: 0, z: 0 }, false))
      .input(InputHelpers.vector3('scale', { x: 1, y: 1, z: 1 }, false))
      .compute(async (_params, _inputs, _context) => {
        // Implementation would go here
        throw new Error('Example node - not implemented');
      })
      .build();
  }
};