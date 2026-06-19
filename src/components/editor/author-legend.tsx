"use client";

import type { AuthorProfile } from "@/lib/editor/author-mark";
import { authorColorVar } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface AuthorLegendProps {
  members: AuthorProfile[];
  currentUserId: string;
  guestCanWrite?: boolean;
  className?: string;
}

type LegendMember = AuthorProfile & { isOwner?: boolean };

export function AuthorLegend({
  members,
  currentUserId,
  guestCanWrite = true,
  className,
}: AuthorLegendProps) {
  const legendMembers = members as LegendMember[];
  const visible = guestCanWrite
    ? legendMembers
    : legendMembers.filter((m) => m.isOwner);

  if (visible.length === 0) return null;

  const label = visible.length === 1 ? "Autor:" : "Autoras:";

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs",
        className
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      {visible.map((m) => {
        const colorVar = authorColorVar(!!m.isOwner);
        return (
        <span key={m.userId} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorVar }}
          />
          <span style={{ color: colorVar }} className="font-medium">
            {m.displayName}
            {m.userId === currentUserId ? " (tú)" : ""}
          </span>
        </span>
        );
      })}
    </div>
  );
}
