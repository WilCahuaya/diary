import { format, subDays, parseISO, isValid } from "date-fns";

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayString(): string {
  return toDateString(new Date());
}

export function yesterdayString(): string {
  return toDateString(subDays(new Date(), 1));
}

export function parseDateString(dateStr: string): Date | null {
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : null;
}

export function isEditableDate(dateStr: string): boolean {
  return dateStr === todayString() || dateStr === yesterdayString();
}

export function isReadOnlyDate(dateStr: string): boolean {
  return !isEditableDate(dateStr);
}

export function resolveDateParam(param: string): string | null {
  if (param === "today") return todayString();
  if (param === "yesterday") return yesterdayString();
  const parsed = parseDateString(param);
  if (!parsed) return null;
  return param;
}
