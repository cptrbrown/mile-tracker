"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      router.replace(session ? "/groups" : "/login");
    })();
  }, [router]);

  return <main style={{ padding: 24 }}>Loading…</main>;
}