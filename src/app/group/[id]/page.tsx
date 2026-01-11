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

  const groupPct = clamp(stats.group_total / groupGoal, 0, 1);
  const myPct = clamp(stats.my_total / myGoal, 0, 1);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{stats.group_name}</h1>
      {error ? <p style={{ marginTop: 12, color: "crimson" }}>{error}</p> : null}

      <GroupTabs groupId={groupId!} />

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Progress</h2>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>Group total</span>
            <span>
              {formatMiles(stats.group_total)} / {formatMiles(groupGoal)}
            </span>
          </div>
          <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: "#eee" }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                width: `${(groupPct * 100).toFixed(1)}%`,
                background: "#111",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>My total</span>
            <span>
              {formatMiles(stats.my_total)} / {formatMiles(myGoal)}
            </span>
          </div>
          <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: "#eee" }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                width: `${(myPct * 100).toFixed(1)}%`,
                background: "#555",
              }}
            />
          </div>
        </div>

        <button
          onClick={loadStats}
          disabled={busy}
          style={{
            marginTop: 14,
            padding: 10,
            border: "1px solid #ccc",
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
