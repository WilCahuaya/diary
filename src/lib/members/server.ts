import type { SupabaseClient } from "@supabase/supabase-js";
import { memberCanWrite } from "@/lib/members";
import { ForbiddenError } from "@/lib/supabase/api";

export interface MemberContext {
  isOwner: boolean;
  guestCanWrite: boolean;
  canWrite: boolean;
}

type MemberRow = {
  user_id: string;
  is_owner: boolean;
  guest_can_write: boolean;
};

export async function getMemberContext(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberContext | null> {
  const { data: rows, error } = await supabase
    .from("diary_members")
    .select("user_id, is_owner, guest_can_write");

  if (error || !rows?.length) {
    return null;
  }

  const current = (rows as MemberRow[]).find((row) => row.user_id === userId);
  if (!current) {
    return null;
  }

  const owner = (rows as MemberRow[]).find((row) => row.is_owner);
  const guestCanWrite = owner?.guest_can_write ?? true;

  return {
    isOwner: current.is_owner,
    guestCanWrite,
    canWrite: memberCanWrite(current.is_owner, guestCanWrite),
  };
}

export async function requireWriteAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberContext> {
  const context = await getMemberContext(supabase, userId);

  if (!context) {
    throw new ForbiddenError("Permiso denegado");
  }

  if (!context.canWrite) {
    throw new ForbiddenError("Solo lectura");
  }

  return context;
}
