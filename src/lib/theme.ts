export const PALETTE = {
  mint: "#B2D8C7",
  lavender: "#D1C4E9",
  sand: "#edebe6",
} as const;

export const AUTHOR_COLOR_VARS = {
  owner: "var(--author-owner)",
  guest: "var(--author-guest)",
} as const;

export const AUTHOR_EXPORT_COLORS = {
  owner: "#4D7563",
  guest: "#7A6A98",
} as const;

export function authorSlot(isOwner: boolean): "owner" | "guest" {
  return isOwner ? "owner" : "guest";
}

export function authorColorVar(isOwner: boolean): string {
  return isOwner ? AUTHOR_COLOR_VARS.owner : AUTHOR_COLOR_VARS.guest;
}

export function authorExportColor(isOwner: boolean): string {
  return isOwner ? AUTHOR_EXPORT_COLORS.owner : AUTHOR_EXPORT_COLORS.guest;
}
