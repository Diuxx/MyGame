/**
 * Reversible editor operations. The history deliberately owns only data and
 * callbacks, never meshes, input events, or scene resources.
 */
export interface EditorCommand {
  readonly label: string;
  run(): void | Promise<void>;
  undo(): void | Promise<void>;
}

export function createEditorCommands(maxLength = 100) {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("La capacité de l'historique doit être positive.");
  }
  const done: EditorCommand[] = [];
  const undone: EditorCommand[] = [];
  let busy = false;

  async function guarded(task: () => Promise<void>): Promise<void> {
    if (busy) throw new Error("Une modification de l'éditeur est déjà en cours.");
    busy = true;
    try { await task(); } finally { busy = false; }
  }

  function remember(command: EditorCommand): void {
    done.push(command);
    if (done.length > maxLength) done.shift();
    undone.length = 0;
  }

  return {
    async execute(command: EditorCommand): Promise<void> {
      await guarded(async () => {
        await command.run();
        remember(command);
      });
    },
    /** Record a drag whose already-applied preview should not be executed again. */
    recordApplied(command: EditorCommand): void {
      if (busy) throw new Error("L'historique est occupé.");
      remember(command);
    },
    async undo(): Promise<boolean> {
      if (!done.length) return false;
      await guarded(async () => {
        const command = done[done.length - 1];
        await command.undo();
        done.pop();
        undone.push(command);
      });
      return true;
    },
    async redo(): Promise<boolean> {
      if (!undone.length) return false;
      await guarded(async () => {
        const command = undone[undone.length - 1];
        await command.run();
        undone.pop();
        done.push(command);
      });
      return true;
    },
    clear(): void {
      if (busy) throw new Error("Une modification est en cours.");
      done.length = 0;
      undone.length = 0;
    },
    get canUndo(): boolean { return done.length > 0; },
    get canRedo(): boolean { return undone.length > 0; },
    get busy(): boolean { return busy; },
    get nextUndoLabel(): string | undefined { return done.at(-1)?.label; },
  };
}

export function groupEditorCommands(label: string, entries: readonly EditorCommand[]): EditorCommand {
  return {
    label,
    async run() {
      const applied: EditorCommand[] = [];
      try {
        for (const entry of entries) {
          await entry.run();
          applied.push(entry);
        }
      } catch (error) {
        for (const entry of applied.reverse()) await entry.undo();
        throw error;
      }
    },
    async undo() {
      const undone: EditorCommand[] = [];
      try {
        for (const entry of [...entries].reverse()) {
          await entry.undo();
          undone.push(entry);
        }
      } catch (error) {
        for (const entry of undone.reverse()) await entry.run();
        throw error;
      }
    },
  };
}
