"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  display_name: string;
  personal_goal_miles: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  // Profile form
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Password form (NO current password)
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  /* ---------- Auth guard ---------- */

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  /* ---------- Load profile ---------- */

  const loadProfile = async () => {
    if (!session) return;

    setErr("");
    setMsg("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, personal_goal_miles")
      .eq("id", session.user.id)
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    const row = data as ProfileRow;
    setProfile(row);
    setDisplayName(row.display_name ?? "");
    setGoal(String(Number(row.personal_goal_miles ?? 250)));
  };

  useEffect(() => {
    if (session) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /* ---------- Save profile ---------- */

  const saveProfile = async () => {
    if (!session) return;

    setBusy(true);
    setErr("");
    setMsg("");

    const g = Number(goal);
    if (Number.isNaN(g) || g <= 0) {
      setBusy(false);
      setErr("Goal must be a number greater than 0.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || "Member",
        personal_goal_miles: Number(g.toFixed(2)),
      })
      .eq("id", session.user.id);

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Saved!");
    await loadProfile();
    setTimeout(() => setMsg(""), 2000);
  };

  /* ---------- Change password (no current password) ---------- */

  const changePassword = async () => {
    setPwErr("");
    setPwMsg("");

    if (!session) {
      setPwErr("You must be logged in.");
      return;
    }

    if (newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== newPassword2) {
      setPwErr("Passwords do not match.");
      return;
    }

    setPwBusy(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setPwBusy(false);

    if (error) {
      setPwErr(error.message);
      return;
    }

    setPwMsg("Password updated!");
    setNewPassword("");
    setNewPassword2("");
    setTimeout(() => setPwMsg(""), 2500);
  };

  /* ---------- Render ---------- */

  if (loading) return <main className="px-4 py-6">Loading…</main>;
  if (!session) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Back
        </button>
      </div>

      {/* Profile messages */}
      {err ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {msg}
        </p>
      ) : null}

      {/* Profile settings */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Your info</h2>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-600">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Chris"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-600">Personal goal (miles)</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              inputMode="decimal"
              placeholder="e.g., 250"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            />
          </label>

          <button
            onClick={saveProfile}
            disabled={busy || !profile}
            className="mt-1 rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>

          <p className="text-sm text-zinc-600">
            Your goal affects your personal progress and milestones.
          </p>
        </div>
      </section>

      {/* Password messages */}
      {pwErr ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {pwErr}
        </p>
      ) : null}
      {pwMsg ? (
        <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {pwMsg}
        </p>
      ) : null}

      {/* Change password */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Choose a new password for your account.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-600">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
              placeholder="At least 6 characters"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-600">Confirm new password</span>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            />
          </label>

          <button
            onClick={changePassword}
            disabled={pwBusy}
            className="mt-1 rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
          >
            {pwBusy ? "Updating…" : "Update password"}
          </button>

          <p className="text-xs text-zinc-500">
            Forgot your password? Use the reset link from the login page.
          </p>
        </div>
      </section>
    </main>
  );
}
