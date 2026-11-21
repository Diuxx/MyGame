import { requireElement } from "../ui/dom";
import { CATALOG_CATEGORIES, catalogType, matchesCatalogEntry, type CatalogEntry, type CatalogFilter } from "./catalogEntries";
import { createCatalogThumbnails } from "./catalogThumbnails";

/** Catalogue presentation only: the World Editor retains placement ownership. */
export function bindVisualCatalog(signal: AbortSignal) {
  const search = requireElement<HTMLInputElement>("worldEditorCatalogSearch");
  const filter = requireElement<HTMLSelectElement>("worldEditorCatalogFilter");
  const grid = requireElement("worldEditorCatalogItems");
  const count = requireElement("worldEditorCatalogCount");
  const empty = requireElement("worldEditorCatalogEmpty");
  const thumbnails = createCatalogThumbnails(signal);
  let cards: { entry: CatalogEntry; button: HTMLButtonElement }[] = [];

  for (const [value, label] of Object.entries(CATALOG_CATEGORIES)) {
    filter.add(new Option(label, value));
  }
  filter.add(new Option("Blocs modulaires (toutes catégories)", "prefabs"));

  function refreshFilter(): void {
    let visibleCount = 0;
    for (const { entry, button } of cards) {
      const visible = matchesCatalogEntry(entry, filter.value as CatalogFilter, search.value);
      button.hidden = !visible;
      if (visible) visibleCount++;
    }
    count.textContent = visibleCount + (visibleCount === 1 ? " élément" : " éléments");
    empty.hidden = visibleCount !== 0;
  }

  function createCard(entry: CatalogEntry): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nz-button nz-button-secondary catalog-card";
    button.dataset.kind = entry.kind;
    button.dataset.id = entry.id;
    button.dataset.label = entry.name;
    button.setAttribute("aria-pressed", "false");
    button.title = entry.name + " · " + catalogType(entry) + " · " + entry.id;

    const preview = document.createElement("span");
    preview.className = "catalog-card-preview";
    preview.textContent = "Aperçu 3D";
    preview.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "catalog-card-name";
    name.textContent = entry.name;
    const type = document.createElement("span");
    type.className = "catalog-card-type";
    type.textContent = catalogType(entry);
    button.append(preview, name, type);
    thumbnails.observe(preview, entry.preview);
    return button;
  }

  search.addEventListener("input", refreshFilter, { signal });
  filter.addEventListener("change", refreshFilter, { signal });

  return {
    render(entries: readonly CatalogEntry[]): void {
      thumbnails.reset();
      cards = entries.map(entry => ({ entry, button: createCard(entry) }));
      grid.replaceChildren(...cards.map(({ button }) => button));
      refreshFilter();
    },
  };
}
