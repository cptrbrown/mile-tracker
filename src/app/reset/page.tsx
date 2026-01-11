"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // If they didn’t come here through the recovery email flow,
    // they may not have a session to update the password.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErr("This reset link is invalid or expired. Please request a new one.");
      }
    };
    check();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Password updated! Redirecting to groups…");
    setTimeout(() => router.replace("/groups"), 1200);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Enter your new password below.
      </p>

      {err ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      ) : null}

      {msg ? (
        <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {msg}
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-6 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-zinc-600">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="At least 6 characters"
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-600">Confirm new password</span>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}