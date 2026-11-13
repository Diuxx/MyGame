export function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément HTML manquant : ${id}`);
  return element as T;
}
