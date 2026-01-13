"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import GroupTabs from "../GroupTabs";

type GroupStats = {
  group_id: string;
  group_name: string;
  goal_miles: number;
  group_total: number;
  my_total: number;
  my_goal: number;
};

const BASE_MILESTONES = [10, 25, 50, 100, 150, 200, 250];

function formatMiles(n: number) {
  return Number(n).toFixed(2);
}

function buildMilestones(target: number) {
  const t = Number(target);
  const list = BASE_MILESTONES.map((m) => (m === 250 ? t : m)).filter((m) => m > 0 && m <= t);
  return Array.from(new Set(list)).sort((a, b) => a - b);
}

function nextMilestone(milestones: number[], total: number) {
  return milestones.find((m) => total < m) ?? null;
}

export default function BadgesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState("");

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

    setStats({
      group_id: row.group_id,
      group_name: row.group_name,
      goal_miles: Number(row.goal_miles),
      group_total: Number(row.group_total),
      my_total: Number(row.my_total),
      my_goal: Number(row.my_goal ?? 250),
    });
  };

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  if (!canShow) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!stats) return <main style={{ padding: 24 }}>Loading group…</main>;

  const groupGoal = stats.goal_miles || 250;
  const myGoal = stats.my_goal || 250;

  const groupMilestones = buildMilestones(groupGoal);
  const myMilestones = buildMilestones(myGoal);

  const nextGroup = nextMilestone(groupMilestones, stats.group_total);
  const nextMine = nextMilestone(myMilestones, stats.my_total);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{stats.group_name}</h1>
      {error ? <p style={{ marginTop: 12, color: "var(--danger)" }}>{error}</p> : null}

      <GroupTabs groupId={groupId!} />

      <section style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Badges</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Group milestones</h3>
              <span style={{ fontSize: 14 }}>
                {formatMiles(stats.group_total)} / {formatMiles(groupGoal)}
              </span>
            </div>

            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {groupMilestones.map((m) => {
                const earned = stats.group_total >= m;
                return (
                  <div
                    key={`g-${m}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: earned ? "var(--card2)" : "transparent",
                    }}
                  >
                    <span style={{ fontWeight: earned ? 700 : 500 }}>
                      {earned ? "✅" : "⬜"} {m} miles
                    </span>
                    <span style={{ fontSize: 14 }}>
                      {earned ? "Earned" : nextGroup === m ? "Next up" : ""}
                    </span>
                  </div>
                );
              })}
              {nextGroup === null ? <p style={{ marginTop: 6 }}>🎉 Group goal achieved!</p> : null}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Your milestones</h3>
              <span style={{ fontSize: 14 }}>
                {formatMiles(stats.my_total)} / {formatMiles(myGoal)}
              </span>
            </div>

            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {myMilestones.map((m) => {
                const earned = stats.my_total >= m;
                return (
                  <div
                    key={`m-${m}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: earned ? "var(--card2)" : "transparent",
                    }}
                  >
                    <span style={{ fontWeight: earned ? 700 : 500 }}>
                      {earned ? "✅" : "⬜"} {m} miles
                    </span>
                    <span style={{ fontSize: 14 }}>
                      {earned ? "Earned" : nextMine === m ? "Next up" : ""}
                    </span>
                  </div>
                );
              })}
              {nextMine === null ? <p style={{ marginTop: 6 }}>🏆 You hit your goal!</p> : null}
            </div>
          </div>
        </div>

        <button
          onClick={loadStats}
          style={{
            marginTop: 14,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          Refresh
        </button>
      </section>
    </main>
  );
}
