"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Search,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./theme-toggle";
import { cn, formatDisplayDate, formatShortDate } from "@/lib/utils";
import { todayString, yesterdayString, isEditableDate } from "@/lib/dates";

interface AppHeaderProps {
  entryDate?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  canGoNext?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function AppHeader({
  entryDate,
  onPrevDay,
  onNextDay,
  canGoNext = false,
  isFavorite = false,
  onToggleFavorite,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isDiary = pathname.startsWith("/diary");
  const today = todayString();
  const yesterday = yesterdayString();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex min-h-14 max-w-3xl items-center justify-between gap-2 px-3 sm:px-4">
        {isDiary && entryDate ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onPrevDay}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent sm:p-1.5"
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 px-1 text-center">
              <p className="truncate text-sm font-medium capitalize sm:text-base">
                {entryDate === today
                  ? "Hoy"
                  : entryDate === yesterday
                    ? "Ayer"
                    : (
                      <>
                        <span className="md:hidden">{formatShortDate(entryDate)}</span>
                        <span className="hidden md:inline">{formatDisplayDate(entryDate)}</span>
                      </>
                    )}
              </p>
              {isEditableDate(entryDate) && (
                <p className="hidden text-xs text-muted-foreground sm:block">Editable</p>
              )}
              {!isEditableDate(entryDate) && (
                <p className="hidden text-xs text-muted-foreground sm:block">Solo lectura</p>
              )}
            </div>
            <button
              type="button"
              onClick={onNextDay}
              disabled={!canGoNext}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent disabled:opacity-30 sm:p-1.5"
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className={cn(
                  "rounded-lg p-2 transition-colors sm:ml-0.5 sm:p-1.5",
                  isFavorite
                    ? "text-amber-500 hover:text-amber-600"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent"
                )}
                aria-label={isFavorite ? "Quitar favorito" : "Marcar favorito"}
              >
                <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
              </button>
            )}
          </div>
        ) : (
          <Link href="/diary/today" className="shrink-0 py-2 text-sm font-semibold tracking-tight sm:text-base">
            Mi diario
          </Link>
        )}

        <nav className="flex shrink-0 items-center gap-0 sm:gap-0.5">
          <Link
            href="/calendar"
            className={cn(
              "rounded-lg p-2.5 transition-colors hover:bg-accent active:bg-accent sm:p-2",
              pathname === "/calendar" && "bg-accent text-accent-foreground"
            )}
            aria-label="Calendario"
          >
            <Calendar className="h-5 w-5" />
          </Link>
          <Link
            href="/search"
            className={cn(
              "rounded-lg p-2.5 transition-colors hover:bg-accent active:bg-accent sm:p-2",
              pathname === "/search" && "bg-accent text-accent-foreground"
            )}
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            className={cn(
              "rounded-lg p-2.5 transition-colors hover:bg-accent active:bg-accent sm:p-2",
              pathname === "/settings" && "bg-accent text-accent-foreground"
            )}
            aria-label="Ajustes"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <ThemeToggle className="p-2.5 sm:p-2" />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent sm:p-2"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </header>
  );
}
