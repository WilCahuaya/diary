import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/api";

export async function POST(request: NextRequest) {
  try {
    const { supabase, withCookies } = createClientFromRequest(request);
    await supabase.auth.signOut();
    return withCookies(NextResponse.json({ success: true }));
  } catch {
    return NextResponse.json({ success: true });
  }
}
