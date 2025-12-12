import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { usePreferencesStore, PreferencesState } from "../../store/preferencesStore";
import { PostProcessManagerDependencies, IPostProcessManager } from "./PostProcessTypes";

export class PostProcessManager implements IPostProcessManager {
  private _composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private ssaoPass: SSAOPass | null = null;

  constructor(private dependencies: PostProcessManagerDependencies) {
    const preferences = usePreferencesStore.getState();
    if (preferences.renderer.postProcessing.enabled) {
      this.updatePostProcessing();
    }
  }

  public get composer(): EffectComposer | null {
    return this._composer;
  }

  public initializePostProcessing(): void {
    if (!this.dependencies.renderer || !this.dependencies.scene) return;

    this.disposePostProcessing();

    const preferences = usePreferencesStore.getState();
    const { passes } = preferences.renderer.postProcessing;

    this._composer = new EffectComposer(this.dependencies.renderer);
    this.renderPass = new RenderPass(this.dependencies.scene, this.dependencies.getCurrentCamera());
    this._composer.addPass(this.renderPass);

    if (passes.includes("ssao") && !this.dependencies.isOrthographic) {
      try {
        const { ssaoKernelRadius, ssaoMinDistance, ssaoMaxDistance, ssaoIntensity } =
          preferences.renderer.postProcessing;
        const canvas = this.dependencies.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        console.log("Initializing SSAO pass:", {
          width,
          height,
          camera: this.dependencies.getCurrentCamera().type,
        });

        this.ssaoPass = new SSAOPass(this.dependencies.scene, this.dependencies.getCurrentCamera(), width, height);
        this.ssaoPass.kernelRadius = Math.min(Math.max(ssaoKernelRadius, 1), 32);
        this.ssaoPass.minDistance = Math.min(Math.max(ssaoMinDistance, 0.001), 0.02);
        this.ssaoPass.maxDistance = Math.min(Math.max(ssaoMaxDistance, 0.05), 0.5);

        this.ssaoPass.output = SSAOPass.OUTPUT.Default;

        if (this.ssaoPass.ssaoMaterial && this.ssaoPass.ssaoMaterial.uniforms) {
          if (this.ssaoPass.ssaoMaterial.uniforms.intensity) {
            this.ssaoPass.ssaoMaterial.uniforms.intensity.value = Math.min(Math.max(ssaoIntensity, 0.1), 2.0);
          }
        }

        this._composer.addPass(this.ssaoPass);
        console.log("SSAO pass initialized successfully");
      } catch (error) {
        console.error("Failed to initialize SSAO pass:", error);
        this.ssaoPass = null;
      }
    }

    if (passes.includes("bloom")) {
      const { bloomStrength } = preferences.renderer.postProcessing;
      const canvas = this.dependencies.renderer.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), bloomStrength, 0.4, 0.4);
      this._composer.addPass(this.bloomPass);
    }

    const hasSSAO = passes.includes("ssao") && !this.dependencies.isOrthographic;
    const hasBloom = passes.includes("bloom");

    if (hasBloom) {
      this.bloomPass!.renderToScreen = true;
      if (this.ssaoPass) this.ssaoPass.renderToScreen = false;
    } else if (hasSSAO && this.ssaoPass) {
      this.ssaoPass.renderToScreen = true;
      if (this.bloomPass) this.bloomPass.renderToScreen = false;
    }

    const canvas = this.dependencies.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this._composer.setSize(width, height);
  }

  public updatePostProcessing(): void {
    const preferences = usePreferencesStore.getState();
    const { postProcessing } = preferences.renderer;

    if (postProcessing.enabled && postProcessing.passes.length > 0) {
      this.initializePostProcessing();
    } else {
      this.disposePostProcessing();
    }
  }

  public setSize(width: number, height: number): void {
    if (this._composer) {
      this._composer.setSize(width, height);

      if (this.ssaoPass) {
        this.ssaoPass.setSize(width, height);
      }

      if (this.bloomPass) {
        this.bloomPass.setSize(width, height);
      }
    }
  }

  public render(): void {
    if (this._composer) {
      this._composer.render();
    }
  }

  public updateFromPreferences(
    newPostProcessPrefs: PreferencesState["renderer"]["postProcessing"],
    prevPostProcessPrefs: PreferencesState["renderer"]["postProcessing"]
  ): void {
    if (
      newPostProcessPrefs.enabled !== prevPostProcessPrefs.enabled ||
      JSON.stringify(newPostProcessPrefs.passes) !== JSON.stringify(prevPostProcessPrefs.passes) ||
      newPostProcessPrefs.bloomStrength !== prevPostProcessPrefs.bloomStrength ||
      newPostProcessPrefs.ssaoKernelRadius !== prevPostProcessPrefs.ssaoKernelRadius ||
      newPostProcessPrefs.ssaoMinDistance !== prevPostProcessPrefs.ssaoMinDistance ||
      newPostProcessPrefs.ssaoMaxDistance !== prevPostProcessPrefs.ssaoMaxDistance ||
      newPostProcessPrefs.ssaoIntensity !== prevPostProcessPrefs.ssaoIntensity
    ) {
      this.updatePostProcessing();
    }
  }

  public updateCameraReference(): void {
    if (this.renderPass) {
      this.renderPass.camera = this.dependencies.getCurrentCamera();
    }

    if (this.ssaoPass) {
      this.ssaoPass.camera = this.dependencies.getCurrentCamera();
    }
  }

  public dispose(): void {
    this.disposePostProcessing();
  }

  private disposePostProcessing(): void {
    if (this._composer) {
      this._composer.dispose();
      this._composer = null;
    }

    if (this.renderPass) {
      this.renderPass = null;
    }

    if (this.bloomPass) {
      this.bloomPass = null;
    }

    if (this.ssaoPass) {
      if (typeof this.ssaoPass.dispose === "function") {
        this.ssaoPass.dispose();
      }
      this.ssaoPass = null;
    }
  }
}
