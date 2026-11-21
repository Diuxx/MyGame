import iconSpriteUrl from "@nicolabz/design-system/icons.svg?url";

/** Icon names are restricted to symbols shipped in the pinned Nicolabz sprite. */
export type NicolabzIconName =
  | "arrow-left" | "arrow-right" | "bell" | "boxes" | "bug" | "clipboard"
  | "copy" | "download" | "file" | "folder" | "menu" | "pencil"
  | "rocket" | "search" | "settings" | "square-pen" | "trash-2"
  | "user" | "users-round" | "shield" | "x";

export function createNicolabzIcon(name: NicolabzIconName): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("nz-icon", "nz-icon-sm");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const use = document.createElementNS(namespace, "use");
  use.setAttribute("href", `${iconSpriteUrl}#${name}`);
  svg.append(use);
  return svg;
}

/** Preserve the original button and its event listeners; replace visuals only. */
export function setNicolabzButtonIcon(
  button: HTMLButtonElement, name: NicolabzIconName, label?: string,
): void {
  const icon = createNicolabzIcon(name);
  if (label) button.replaceChildren(icon, document.createTextNode(label));
  else button.replaceChildren(icon);
}
