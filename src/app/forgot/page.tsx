"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!email.trim()) {
      setErr("Please enter your email.");
      return;
    }

    setBusy(true);

    // Send the user to /auth/callback which will exchange the code for a session,
    // then it will redirect to /reset (via next param).
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback?next=/reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("If an account exists for that email, a reset link was sent.");
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <button
        onClick={() => router.push("/login")}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
      >
        ← Back to login
      </button>

      <h1 className="mt-4 text-2xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Enter your email and we’ll send a password reset link.
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
          <span className="text-sm text-zinc-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="you@example.com"
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </main>
  );
}
