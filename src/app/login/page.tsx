"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "../AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && session) router.replace("/groups");
  }, [loading, session, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setBusy(true);
    setErr("");
    setMsg("");

    if (!email.trim()) {
      setBusy(false);
      setErr("Please enter your email.");
      return;
    }
    if (password.length < 6) {
      setBusy(false);
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      setBusy(false);

      if (error) {
        setErr(error.message);
        return;
      }

      // If email confirmation is ON in Supabase, they must confirm before login.
      setMsg(
        "Account created. If email confirmation is enabled, check your email to confirm before logging in."
      );
      return;
    }

    // login
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.replace("/groups");
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {mode === "login"
          ? "Log in with your email and password."
          : "Create an account using your email and a password."}
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

        <label className="grid gap-1">
          <span className="text-sm text-zinc-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="At least 6 characters"
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="mt-6 text-sm">
        {mode === "login" ? (
          <button
            onClick={() => {
              setMode("signup");
              setErr("");
              setMsg("");
            }}
            className="font-medium underline"
          >
            Need an account? Create one
          </button>
        ) : (
          <button
            onClick={() => {
              setMode("login");
              setErr("");
              setMsg("");
            }}
            className="font-medium underline"
          >
            Already have an account? Log in
          </button>
        )}
      </div>
      
<div className="mt-3 text-sm">
  <button
    onClick={() => router.push("/forgot")}
    className="font-medium underline"
  >
    Forgot password?
  </button>
</div>

      <div className="mt-4 text-xs text-zinc-500">
        Forgot password? We can add password reset next.
      </div>
    </main>
  );
}
