"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import GroupTabs from "../GroupTabs";

type GroupStats = {
  group_id: string;
  group_name: string;
};

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_miles: number;
};

function formatMiles(n: number) {
  return Number(n).toFixed(2);
}

export default function LeaderboardPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
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
    });
  };

  const loadLeaderboard = async () => {
    if (!groupId) return;
    setError("");

    const { data, error } = await supabase.rpc("get_group_leaderboard", { gid: groupId });
    if (error) {
      setError(error.message);
      return;
    }

    setLeaders(
      (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.display_name,
        total_miles: Number(r.total_miles),
      }))
    );
  };

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  if (!canShow) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!stats) return <main style={{ padding: 24 }}>Loading group…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{stats.group_name}</h1>
      {error ? <p style={{ marginTop: 12, color: "crimson" }}>{error}</p> : null}

      <GroupTabs groupId={groupId!} />

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Leaderboard</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {leaders.length === 0 ? (
            <p>No members found.</p>
          ) : (
            leaders.map((m, idx) => {
              const isMe = session?.user.id === m.user_id;
              return (
                <div
                  key={m.user_id}
                  style={{
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isMe ? "#f7f7f7" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <strong style={{ width: 28 }}>{idx + 1}.</strong>
                    <span style={{ fontWeight: isMe ? 700 : 500 }}>
                      {m.display_name}
                      {isMe ? " (you)" : ""}
                    </span>
                  </div>
                  <span>{formatMiles(m.total_miles)} mi</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
