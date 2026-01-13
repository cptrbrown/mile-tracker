"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import GroupTabs from "./GroupTabs";

type GroupStats = {
  group_id: string;
  group_name: string;
  goal_miles: number;
  group_total: number;
  my_total: number;
  my_goal: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMiles(n: number) {
  return Number(n).toFixed(2);
}

export default function GroupOverviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Allow editing group goal + personal goal from Overview
  const [groupGoalEdit, setGroupGoalEdit] = useState("");
  const [myGoalEdit, setMyGoalEdit] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const canShow = useMemo(
    () => !loading && !!session && !!groupId,
    [loading, session, groupId]
  );

  const loadStats = async () => {
    if (!groupId) return;
    setError("");

    const { data, error } = await supabase.rpc("get_group_stats", { gid: groupId });

    if (error) {
      setError(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      setError("Group not found or you don’t have access.");
      return;
    }

    const nextStats: GroupStats = {
      group_id: row.group_id,
      group_name: row.group_name,
      goal_miles: Number(row.goal_miles),
      group_total: Number(row.group_total),
      my_total: Number(row.my_total),
      my_goal: Number(row.my_goal ?? 250),
    };

    setStats(nextStats);
    setGroupGoalEdit(String(nextStats.goal_miles || 250));
    setMyGoalEdit(String(nextStats.my_goal || 250));
  };

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  const saveGroupGoal = async () => {
    if (!session || !groupId) return;
    const n = Number(groupGoalEdit);
    if (Number.isNaN(n) || n <= 0) {
      setError("Group goal must be a number greater than 0.");
      return;
    }

    setBusy(true);
    setError("");

    // If your schema stores group goal on groups.goal_miles, this is correct:
    const { error } = await supabase
      .from("groups")
      .update({ goal_miles: Number(n.toFixed(2)) })
      .eq("id", groupId);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    await loadStats();
  };

  const saveMyGoal = async () => {
    if (!session) return;
    const n = Number(myGoalEdit);
    if (Number.isNaN(n) || n <= 0) {
      setError("Your goal must be a number greater than 0.");
      return;
    }

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({ personal_goal_miles: Number(n.toFixed(2)) })
      .eq("id", session.user.id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    await loadStats();
  };

  if (!canShow) return <main className="px-4 py-6 text-zinc-900 dark:text-zinc-100">Loading…</main>;
  if (!stats) return <main className="px-4 py-6 text-zinc-900 dark:text-zinc-100">Loading group…</main>;

  const groupGoal = stats.goal_miles || 250;
  const myGoal = stats.my_goal || 250;

  const groupPct = clamp(stats.group_total / groupGoal, 0, 1);
  const myPct = clamp(stats.my_total / myGoal, 0, 1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-zinc-900 dark:text-zinc-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{stats.group_name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Overview
          </p>
        </div>

        <button
          onClick={() => router.push("/groups")}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50
                     dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Back to groups
        </button>
      </div>

      {/* Tabs (these should link to the dedicated pages) */}
      <div className="mt-3">
        <GroupTabs groupId={groupId!} />
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700
                      dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {/* Progress card */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm
                          dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Progress</h2>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Group total</span>
            <span className="font-medium">
              {formatMiles(stats.group_total)} / {formatMiles(groupGoal)}
            </span>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-black dark:bg-white"
              style={{ width: `${(groupPct * 100).toFixed(1)}%` }}
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">My total</span>
            <span className="font-medium">
              {formatMiles(stats.my_total)} / {formatMiles(myGoal)}
            </span>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-zinc-700 dark:bg-zinc-200"
              style={{ width: `${(myPct * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Goals card */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm
                          dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Goals</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Group goal */}
          <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold">Group goal (miles)</div>
            <div className="mt-2 flex gap-2">
              <input
                value={groupGoalEdit}
                onChange={(e) => setGroupGoalEdit(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none
                           focus:ring-2 focus:ring-black/10
                           dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-white/10"
              />
              <button
                onClick={saveGroupGoal}
                disabled={busy}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60
                           dark:bg-white dark:text-black"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Updates the group’s target (used for group badges/milestones).
            </p>
          </div>

          {/* My goal */}
          <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold">My goal (miles)</div>
            <div className="mt-2 flex gap-2">
              <input
                value={myGoalEdit}
                onChange={(e) => setMyGoalEdit(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none
                           focus:ring-2 focus:ring-black/10
                           dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-white/10"
              />
              <button
                onClick={saveMyGoal}
                disabled={busy}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60
                           dark:bg-white dark:text-black"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Sets your personal target (used for your milestones).
            </p>
          </div>
        </div>
      </section>

      {/* Quick links card */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm
                          dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Quick links</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            onClick={() => router.push(`/group/${groupId}/leaderboard`)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50
                       dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Leaderboard
          </button>
          <button
            onClick={() => router.push(`/group/${groupId}/log`)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50
                       dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Log miles
          </button>
          <button
            onClick={() => router.push(`/group/${groupId}/badges`)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50
                       dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Badges
          </button>
          <button
            onClick={() => router.push(`/group/${groupId}/hikes`)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50
                       dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Hikes
          </button>
          <button
            onClick={() => router.push(`/group/${groupId}/feed`)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50
                       dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Feed
          </button>
        </div>
      </section>
    </main>
  );
}
