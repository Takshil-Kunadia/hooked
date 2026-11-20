"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { LABEL_LAYER } from "./map/labels";

/** Post-processing drops the browser's anti-aliasing, so the scene target gets MSAA ×4 itself. */
const MSAA_SAMPLES = 4;
/** Round 5's bloom: soft and wide, with a threshold high enough that white signs never glow. */
const BLOOM = { strength: 0.55, radius: 0.5, threshold: 0.93 } as const;
/** Runs after R3F's own frame work and replaces its render (any priority above 0 does). */
const RENDER_PRIORITY = 1;

/** A no-draw pass that switches a camera layer on or off between two other passes. */
class CameraLayerPass extends Pass {
  private readonly camera: Camera;
  private readonly layer: number;
  private readonly on: boolean;

  constructor(camera: Camera, layer: number, on: boolean) {
    super();
    this.camera = camera;
    this.layer = layer;
    this.on = on;
    this.needsSwap = false;
  }

  override render(): void {
    if (this.on) this.camera.layers.enable(this.layer);
    else this.camera.layers.disable(this.layer);
  }
}

interface Pipeline {
  readonly composer: EffectComposer;
  readonly gtao: GTAOPass;
  readonly bloom: UnrealBloomPass;
  dispose(): void;
}

/**
 * Round 5's composer: render (MSAA) → soft AO → bloom → tone mapping and sRGB output.
 * Built at the renderer's CSS size; the composer scales its targets by the pixel ratio.
 */
function createPipeline(gl: WebGLRenderer, scene: Scene, camera: Camera): Pipeline {
  const { x: w, y: h } = gl.getSize(new Vector2());
  const target = new WebGLRenderTarget(w, h, { samples: MSAA_SAMPLES, type: HalfFloatType });
  const composer = new EffectComposer(gl, target);
  const gtao = new GTAOPass(scene, camera, w, h);
  const bloom = new UnrealBloomPass(new Vector2(w, h), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const output = new OutputPass();
  const passes = [
    new RenderPass(scene, camera),
    /* labels stay out of the AO pass, which would draw them as opaque slabs */
    new CameraLayerPass(camera, LABEL_LAYER, false),
    gtao,
    new CameraLayerPass(camera, LABEL_LAYER, true),
    bloom,
    output,
  ];
  passes.forEach((pass) => composer.addPass(pass));
  return {
    composer,
    gtao,
    bloom,
    dispose() {
      passes.forEach((pass) => pass.dispose());
      composer.dispose();
    },
  };
}

interface EffectsProps {
  /** Dusk only. */
  readonly bloom: boolean;
  /** Soft ambient occlusion; round 5 turns it off on phones. */
  readonly ambientOcclusion: boolean;
}

/** Owns the post-processing chain and renders every frame through it. */
export function Effects({ bloom, ambientOcclusion }: EffectsProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const pipeline = useRef<Pipeline | null>(null);

  useLayoutEffect(() => {
    const created = createPipeline(gl, scene, camera);
    pipeline.current = created;
    return () => {
      pipeline.current = null;
      created.dispose();
    };
  }, [gl, scene, camera]);

  /* size, pixel ratio and toggles, re-applied after a rebuild too */
  useLayoutEffect(() => {
    const p = pipeline.current;
    if (!p) return;
    p.composer.setPixelRatio(dpr);
    p.composer.setSize(size.width, size.height);
    p.bloom.enabled = bloom;
    p.gtao.enabled = ambientOcclusion;
    invalidate();
  }, [gl, scene, camera, size.width, size.height, dpr, bloom, ambientOcclusion, invalidate]);

  useFrame((_, delta) => {
    pipeline.current?.composer.render(delta);
  }, RENDER_PRIORITY);

  return null;
}
