import { ArcRotateCamera, Camera, Color3, Color4, Engine, HemisphericLight,
  DirectionalLight, LoadAssetContainerAsync, Scene, TransformNode, Vector3,
  type AbstractMesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF/index.js";
import { createPrefabRenderer } from "../world/maps/prefabRenderer";
import type { CatalogPreview } from "./catalogEntries";

const SIZE = 256;
const CACHE_LIMIT = 160;

function previewKey(preview: CatalogPreview): string {
  return "model" in preview ? preview.model : JSON.stringify(preview.prefab.parts);
}

/** One isolated renderer, used serially. Cards only display cached image data. */
class ThumbnailRenderer {
  private readonly canvas = document.createElement("canvas");
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;

  constructor() {
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true });
    this.engine.setSize(SIZE, SIZE);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.93, 0.94, 0.92, 1);
    this.camera = new ArcRotateCamera("catalog-camera", -Math.PI / 3, Math.PI / 3, 5, Vector3.Zero(), this.scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.01;
    new HemisphericLight("catalog-fill", new Vector3(0, 1, 0), this.scene).intensity = 0.85;
    const key = new DirectionalLight("catalog-key", new Vector3(-1, -2, 1), this.scene);
    key.diffuse = Color3.White();
    key.intensity = 1.1;
  }

  private async capture(meshes: AbstractMesh[]): Promise<string> {
    const visible = meshes.filter(mesh => mesh.getTotalVertices() > 0 && mesh.isEnabled() && mesh.isVisible);
    if (!visible.length) throw new Error("Modèle vide.");
    const minimum = new Vector3(Infinity, Infinity, Infinity);
    const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of visible) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      minimum.minimizeInPlace(box.minimumWorld);
      maximum.maximizeInPlace(box.maximumWorld);
    }
    const center = minimum.add(maximum).scale(0.5);
    const radius = Math.max(maximum.subtract(minimum).length() / 2, 0.05);
    const extent = radius * 1.12;
    this.camera.setTarget(center);
    this.camera.alpha = -Math.PI / 3;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = radius * 3;
    this.camera.maxZ = radius * 10 + 10;
    this.camera.orthoLeft = -extent;
    this.camera.orthoRight = extent;
    this.camera.orthoTop = extent;
    this.camera.orthoBottom = -extent;
    await this.scene.whenReadyAsync();
    this.scene.render();
    return this.canvas.toDataURL("image/webp", 0.82);
  }

  async render(preview: CatalogPreview): Promise<string> {
    if ("model" in preview) {
      const container = await LoadAssetContainerAsync(preview.model, this.scene, {
        pluginOptions: { gltf: { animationStartMode: 0 } },
      });
      try {
        container.addAllToScene();
        this.scene.activeCamera = this.camera;
        return await this.capture(container.meshes);
      } finally {
        container.removeAllFromScene();
        container.dispose();
      }
    }
    const root = new TransformNode("catalog-prefab", this.scene);
    let renderer: ReturnType<typeof createPrefabRenderer> | undefined;
    try {
      renderer = createPrefabRenderer(this.scene, root, { preview: preview.prefab }, [
        { id: "preview", prefab: "preview", position: [0, 0, 0], rotationY: 0, scale: 1 },
      ]);
      return await this.capture(root.getChildMeshes());
    } finally {
      renderer?.dispose();
      root.dispose();
    }
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}

interface PreviewRequest {
  target: HTMLElement;
  preview: CatalogPreview;
}

/** Only visible cards are queued. Leaving the catalogue stops scheduling work. */
export function createCatalogThumbnails(signal: AbortSignal) {
  const requests = new Map<Element, PreviewRequest>();
  const visible = new Set<Element>();
  const cache = new Map<string, string | null>();
  let renderer: ThumbnailRenderer | undefined;
  let running = false;

  function show(target: HTMLElement, url: string | null): void {
    if (!url) {
      target.textContent = "Aperçu indisponible";
      return;
    }
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.decoding = "async";
    target.replaceChildren(image);
  }

  async function drain(): Promise<void> {
    if (running || signal.aborted) return;
    running = true;
    try {
      while (!signal.aborted && visible.size > 0) {
        const element = visible.values().next().value!;
        visible.delete(element);
        const request = requests.get(element);
        if (!request || !request.target.isConnected || request.target.getClientRects().length === 0) continue;
        observer.unobserve(element);
        requests.delete(element);
        const key = previewKey(request.preview);
        if (!cache.has(key)) {
          try {
            renderer ??= new ThumbnailRenderer();
            const url = await renderer.render(request.preview);
            if (!signal.aborted) cache.set(key, url);
          } catch (error) {
            console.warn("Catalogue : aperçu indisponible", key, error);
            cache.set(key, null);
          }
          if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
        }
        if (!signal.aborted && request.target.isConnected) show(request.target, cache.get(key) ?? null);
      }
    } finally {
      // Release the extra WebGL context after each batch; the image cache survives.
      renderer?.dispose();
      renderer = undefined;
      running = false;
    }
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && requests.has(entry.target)) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    void drain();
  });

  function reset(): void {
    observer.disconnect();
    requests.clear();
    visible.clear();
  }

  signal.addEventListener("abort", () => {
    reset();
    cache.clear();
    // An in-flight load owns its renderer until its finally block.
  }, { once: true });

  return {
    observe(target: HTMLElement, preview: CatalogPreview): void {
      if (signal.aborted) return;
      const key = previewKey(preview);
      if (cache.has(key)) {
        show(target, cache.get(key) ?? null);
        return;
      }
      requests.set(target, { target, preview });
      observer.observe(target);
    },
    reset,
  };
}
