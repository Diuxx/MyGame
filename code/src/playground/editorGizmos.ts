import { GizmoManager, type Scene, type TransformNode } from "@babylonjs/core";

export type EditorGizmoTool = "select" | "move" | "rotate" | "scale";

/** Babylon's built-in overlay gizmos; this only owns their lifecycle and attachment. */
export function createEditorGizmos(scene: Scene) {
  const manager = new GizmoManager(scene);
  manager.usePointerToAttachGizmos = false;
  let tool: EditorGizmoTool = "select";
  let target: TransformNode | undefined;

  function refresh(): void {
    manager.positionGizmoEnabled = tool === "move";
    manager.rotationGizmoEnabled = tool === "rotate";
    manager.scaleGizmoEnabled = tool === "scale";
    manager.attachToNode(tool === "select" ? null : (target ?? null));
  }

  return {
    setTool(next: EditorGizmoTool): void { tool = next; refresh(); },
    attach(node: TransformNode | undefined): void { target = node; refresh(); },
    detach(): void { target = undefined; manager.attachToNode(null); },
    get tool(): EditorGizmoTool { return tool; },
    dispose(): void { manager.dispose(); },
  };
}
