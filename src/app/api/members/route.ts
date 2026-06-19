import { NextRequest } from "next/server";
import { memberCanWrite } from "@/lib/members";
import { getMemberContext } from "@/lib/members/server";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
  ForbiddenError,
} from "@/lib/supabase/api";

type MemberRow = {
  user_id: string;
  display_name: string;
  color: string;
  is_owner: boolean;
  guest_can_write: boolean;
};

function mapMember(row: MemberRow, guestCanWrite: boolean) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    color: row.color,
    isOwner: row.is_owner,
    canWrite: memberCanWrite(row.is_owner, guestCanWrite),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { data: members, error } = await supabase
      .from("diary_members")
      .select("user_id, display_name, color, is_owner, guest_can_write")
      .order("is_owner", { ascending: false });

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    const rows = (members ?? []) as MemberRow[];
    const current = rows.find((m) => m.user_id === user.id) ?? null;

    if (!current) {
      return jsonWithCookies(
        withCookies,
        { error: "Permiso denegado" },
        { status: 403 }
      );
    }

    const owner = rows.find((m) => m.is_owner);
    const guestCanWrite = owner?.guest_can_write ?? true;

    return jsonWithCookies(withCookies, {
      current: mapMember(current, guestCanWrite),
      members: rows.map((m) => mapMember(m, guestCanWrite)),
      guestCanWrite,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const body = (await request.json()) as {
      displayName?: string;
      guestCanWrite?: boolean;
    };

    if (body.displayName === undefined && body.guestCanWrite === undefined) {
      return jsonWithCookies(
        withCookies,
        { error: "Nada que actualizar" },
        { status: 400 }
      );
    }

    const context = await getMemberContext(supabase, user.id);
    if (!context) {
      return jsonWithCookies(
        withCookies,
        { error: "Permiso denegado" },
        { status: 403 }
      );
    }

    const updates: Partial<Pick<MemberRow, "display_name" | "guest_can_write">> = {};

    if (body.displayName !== undefined) {
      if (!context.canWrite) {
        throw new ForbiddenError("Solo lectura");
      }

      const trimmed = body.displayName.trim();

      if (!trimmed) {
        return jsonWithCookies(
          withCookies,
          { error: "El nombre no puede estar vacío" },
          { status: 400 }
        );
      }

      if (trimmed.length > 40) {
        return jsonWithCookies(
          withCookies,
          { error: "El nombre es demasiado largo (máx. 40 caracteres)" },
          { status: 400 }
        );
      }

      updates.display_name = trimmed;
    }

    if (body.guestCanWrite !== undefined) {
      if (!context.isOwner) {
        throw new ForbiddenError("Permiso denegado");
      }
      updates.guest_can_write = body.guestCanWrite;
    }

    const { data, error } = await supabase
      .from("diary_members")
      .update(updates)
      .eq("user_id", user.id)
      .select("user_id, display_name, color, is_owner, guest_can_write")
      .single();

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    if (!data) {
      return jsonWithCookies(
        withCookies,
        { error: "Permiso denegado" },
        { status: 403 }
      );
    }

    const guestCanWrite = data.is_owner
      ? data.guest_can_write
      : context.guestCanWrite;

    return jsonWithCookies(withCookies, {
      current: mapMember(data as MemberRow, guestCanWrite),
      guestCanWrite: data.is_owner ? data.guest_can_write : context.guestCanWrite,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
