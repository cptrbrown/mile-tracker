"use client";

import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();

  if (!session) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const isGroups = pathname?.startsWith("/groups") || pathname?.startsWith("/group/");
  const isProfile = pathname?.startsWith("/profile");

  const linkClass = (active: boolean) =>
    [
      "rounded-xl border px-3 py-2 text-sm font-medium",
      "transition",
      active ? "bg-var(--card) text-var(--card) border-black" : "bg-var(--card) text-var(--card) border-zinc-200",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-100 bg-var(--card)e/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <button className={linkClass(!!isGroups)} onClick={() => router.push("/groups")}>
            Groups
          </button>
          <button className={linkClass(!!isProfile)} onClick={() => router.push("/profile")}>
            Profile
          </button>
        </div>

        <button
          onClick={signOut}
          className="rounded-xl border border-zinc-200 bg-var(--card) px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50
           dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}