/** Stable detail pages work even when an item is outside the first page of a feed. */
export const recordPath = (id: string) =>
  `/registros/${encodeURIComponent(id)}`;

export function noticePath(notice: {
  path: string;
  entry_id?: string | null;
  kind: string;
}) {
  if (notice.entry_id) {
    if (["approval", "delivery", "failure"].includes(notice.kind))
      return `/equipe?work=${encodeURIComponent(notice.entry_id)}${notice.kind === "approval" ? "&tab=approvals" : ""}`;
    return recordPath(notice.entry_id);
  }
  return notice.path.startsWith("/") && !notice.path.startsWith("//")
    ? notice.path
    : "/notificacoes";
}
