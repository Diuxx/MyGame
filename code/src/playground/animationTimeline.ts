export interface TimelineLane {
  label: string;
  kind: "invulnerable" | "impact" | "cancel" | "blend";
  from(): number;
  until(): number;
}

/** Development-only timeline; gameplay remains independent of the DOM. */
export function createAnimationTimeline(
  container: HTMLElement,
  durationSeconds: () => number,
  lanes: readonly TimelineLane[],
): { refresh(): void; setProgress(value: number): void } {
  const root = document.createElement("div");
  root.className = "action-timeline";
  const title = document.createElement("p");
  title.className = "animation-note";
  title.textContent = "Chronologie · progression de 0 à 100 %";
  root.append(title);

  const tracks = lanes.map((lane) => {
    const row = document.createElement("div");
    row.className = "action-timeline-row";
    const label = document.createElement("span");
    label.className = "action-timeline-label";
    const track = document.createElement("div");
    track.className = "action-timeline-track";
    const segment = document.createElement("span");
    segment.className = "action-timeline-segment " + lane.kind;
    track.append(segment);
    row.append(label, track);
    root.append(row);
    return { lane, label, segment };
  });

  const position = document.createElement("div");
  position.className = "action-timeline-progress";
  const progressLabel = document.createElement("span");
  progressLabel.textContent = "Progression";
  const progressTrack = document.createElement("div");
  progressTrack.className = "action-timeline-track";
  const cursor = document.createElement("span");
  cursor.className = "action-timeline-cursor";
  progressTrack.append(cursor);
  position.append(progressLabel, progressTrack);
  root.append(position);
  container.append(root);

  function refresh(): void {
    const duration = Math.max(0, durationSeconds()) * 1000;
    for (const { lane, label, segment } of tracks) {
      const from = Math.max(0, Math.min(1, lane.from()));
      const until = Math.max(from, Math.min(1, lane.until()));
      segment.style.left = `${from * 100}%`;
      segment.style.width = `${(until - from) * 100}%`;
      label.textContent = `${lane.label} · ${Math.round(from * duration)}–${Math.round(until * duration)} ms`;
    }
  }

  return {
    refresh,
    setProgress(value) {
      cursor.style.left = `${Math.max(0, Math.min(1, value)) * 100}%`;
    },
  };
}
