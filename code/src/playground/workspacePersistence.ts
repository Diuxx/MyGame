/**
 * Persistence feedback describes the action performed, not the existence of a
 * file on disk. A browser download and localStorage never commit to the repo.
 */
export function describeJsonExport(filename: string, versionedPath?: string): string {
  const destination = versionedPath
    ? ` Pour le versionner, intégrer manuellement le fichier dans ${versionedPath}.`
    : "";
  return `Téléchargement demandé : ${filename}. Le dépôt Git n'a pas été modifié.${destination}`;
}

export function describeLocalSave(
  subject: "Brouillon de map" | "Instances d'entraînement",
  action: "saved" | "restored" | "removed",
): string {
  const verbs = subject === "Brouillon de map"
    ? { saved: "enregistré", restored: "restauré", removed: "supprimé" }
    : { saved: "enregistrées", restored: "restaurées", removed: "supprimées" };
  return `${subject} ${verbs[action]} dans ce navigateur. Aucun fichier du projet n'a été modifié.`;
}
