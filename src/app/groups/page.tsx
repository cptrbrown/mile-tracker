"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "../AuthProvider";

type GroupRow = {
  id: string;
  name: string;
  join_code: string;
  goal_miles: number;
  owner_id?: string | null;
};

export default function GroupsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [joinCode, setJoinCode] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupGoal, setNewGroupGoal] = useState("250");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Newly created group join code panel
  const [createdJoinCode, setCreatedJoinCode] = useState<string>("");
  const [createdGroupName, setCreatedGroupName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  /* ---------- Auth guard ---------- */

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  /* ---------- Load admin flag ---------- */

  const loadAdminFlag = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();

    if (error) {
      // If the column doesn't exist yet, or RLS blocks it, default to false
      setIsAdmin(false);
      return;
    }

    setIsAdmin(!!data?.is_admin);
  };

  /* ---------- Load groups ---------- */

  const loadGroups = async () => {
    if (!session) return;

    setError("");

    const { data, error } = await supabase
      .from("groups")
      .select("id, name, join_code, goal_miles, owner_id")
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setGroups(data ?? []);
  };

  useEffect(() => {
    if (!session) return;
    loadAdminFlag();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /* ---------- Join group ---------- */

const joinGroup = async () => {
  if (!session || !joinCode.trim()) return;

  setBusy(true);
  setError("");

  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_code: joinCode.trim(),
  });

  setBusy(false);

  if (error) {
    setError(error.message.includes("Invalid join code") ? "Invalid join code." : error.message);
    return;
  }

  setJoinCode("");
  router.push(`/group/${data}`);
};


  /* ---------- Create group (admin only) ---------- */

  const createGroup = async () => {
    if (!session || !isAdmin) return;
    if (!newGroupName.trim()) return;

    setBusy(true);
    setError("");

    const goal = Number(newGroupGoal);
    if (Number.isNaN(goal) || goal <= 0) {
      setBusy(false);
      setError("Goal must be a number greater than 0.");
      return;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: newGroupName.trim(),
        join_code: code,
        goal_miles: Number(goal.toFixed(2)),
        owner_id: session.user.id,
      })
      .select("id, name, join_code")
      .single();

    if (error || !group) {
      setBusy(false);
      setError(error?.message ?? "Failed to create group.");
      return;
    }

    await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: session.user.id,
    });

    setBusy(false);

    setCreatedJoinCode(group.join_code);
    setCreatedGroupName(group.name);
    setCopied(false);

    setNewGroupName("");
    setNewGroupGoal("250");

    await loadGroups();
  };

  const copyJoinCode = async () => {
    if (!createdJoinCode) return;
    try {
      await navigator.clipboard.writeText(createdJoinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (loading) return <main className="px-4 py-6">Loading…</main>;
  if (!session) return null;

  const shareText = createdJoinCode
    ? `Join my group "${createdGroupName}" with code: ${createdJoinCode}`
    : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Your groups</h1>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Your groups */}
      <section className="mt-4">
        {groups.length === 0 ? (
          <p className="text-sm text-zinc-600">You’re not in any groups yet.</p>
        ) : (
          <div className="grid gap-3">
            {groups.map((g) => {
              const isOwner = g.owner_id === session.user.id;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-zinc-200 bg-var(--card) p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{g.name}</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Goal: {g.goal_miles} miles
                      </div>

                      {/* Show join code only to owners (or admins) */}
                      {isOwner || isAdmin ? (
                        <div className="mt-2 text-sm text-zinc-600">
                          Join code:{" "}
                          <span className="font-mono font-semibold text-black">{g.join_code}</span>
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => router.push(`/group/${g.id}`)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Join group (everyone) */}
      <section className="mt-8 rounded-2xl border border-zinc-200 bg-var(--card) p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Join a group</h2>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Join code"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
          />
          <button
            onClick={joinGroup}
            disabled={busy}
            className="rounded-xl bg-black px-4 py-2 text-base font-medium text-var(--card) disabled:opacity-60"
          >
            Join
          </button>
        </div>
      </section>

      {/* Create group (admin only) */}
      {isAdmin ? (
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-var(--card)var(--card) p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Create a group</h2>

          <div className="mt-3 grid gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            />
            <input
              value={newGroupGoal}
              onChange={(e) => setNewGroupGoal(e.target.value)}
              inputMode="decimal"
              placeholder="Goal miles"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            />

            <button
              onClick={createGroup}
              disabled={busy}
              className="rounded-xl bg-black px-4 py-2 text-base font-medium text-var(--card) disabled:opacity-60"
            >
              Create group
            </button>

            {createdJoinCode ? (
              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-semibold">Group created!</div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-zinc-700">
                    Join code:{" "}
                    <span className="font-mono text-base font-semibold text-black">
                      {createdJoinCode}
                    </span>
                  </div>
                  <button
                    onClick={copyJoinCode}
                    className="rounded-xl border border-zinc-200 bg-var(--card) px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div className="mt-2 text-xs text-zinc-600">Share this message:</div>
                <div className="mt-1 select-text rounded-xl border border-zinc-200 bg-var(--card) p-3 text-sm">
                  {shareText}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-var(--card) p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Create a group</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Only the organizer can create groups. Ask them for a join code.
          </p>
        </section>
      )}
    </main>
  );
}