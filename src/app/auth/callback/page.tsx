"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finish = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      // Create profile row if missing
      const userId = session.user.id;
      const email = session.user.email ?? "";

      // Try to fetch profile
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existing) {
        // Default display name: email prefix
        const displayName = email.includes("@") ? email.split("@")[0] : "User";

        await supabase.from("profiles").insert({
          id: userId,
          display_name: displayName,
          personal_goal_miles: 250,
        });
      }

      router.replace("/groups");
    };

    finish();
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <p>Signing you in…</p>
    </main>
  );
}