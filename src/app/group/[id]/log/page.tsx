"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import GroupTabs from "../GroupTabs";

/* ---------- Types ---------- */

type GroupStats = {
  group_id: string;
  group_name: string;
  goal_miles: number;
  group_total: number;
  my_total: number;
  my_goal: number;
};

/* ---------- Helpers ---------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BASE_MILESTONES = [10, 25, 50, 100, 150, 200, 250];

function formatMiles(n: number) {
  return Number(n).toFixed(2);
}

function buildMilestones(target: number) {
  const t = Number(target);
  const list = BASE_MILESTONES.map((m) => (m === 250 ? t : m)).filter((m) => m > 0 && m <= t);
  return Array.from(new Set(list)).sort((a, b) => a - b);
}

function crossedMilestones(prev: number, curr: number, milestones: number[]) {
  return milestones.filter((m) => prev < m && curr >= m);
}

/* ---------- Component ---------- */

export default function LogPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Celebrations (Option A: here)
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const prevTotalsRef = useRef<{ group: number; mine: number } | null>(null);

  // Log form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [miles, setMiles] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const canShow = useMemo(
    () => !loading && !!session && !!groupId,
    [loading, session, groupId]
  );

  const pushToast = (text: string) => {
    const id =
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();

    setToasts((prev) => [...prev, { id, text }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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

    // celebrations compare before/after
    const prev = prevTotalsRef.current;
    if (prev) {
      const groupGoal = nextStats.goal_miles || 250;
      const myGoal = nextStats.my_goal || 250;

      const groupMilestones = buildMilestones(groupGoal);
      const myMilestones = buildMilestones(myGoal);

      if (nextStats.group_total > prev.group) {
        crossedMilestones(prev.group, nextStats.group_total, groupMilestones).forEach((m) =>
          pushToast(`🎉 Group earned the ${m}-mile badge!`)
        );
        if (prev.group < groupGoal && nextStats.group_total >= groupGoal) {
          pushToast(`🏁 Group goal achieved: ${formatMiles(groupGoal)} miles!`);
        }
      }

      if (nextStats.my_total > prev.mine) {
        crossedMilestones(prev.mine, nextStats.my_total, myMilestones).forEach((m) =>
          pushToast(`🏅 You earned the ${m}-mile badge!`)
        );
        if (prev.mine < myGoal && nextStats.my_total >= myGoal) {
          pushToast(`🏆 You hit your goal: ${formatMiles(myGoal)} miles!`);
        }
      }
    }

    prevTotalsRef.current = { group: nextStats.group_total, mine: nextStats.my_total };
    setStats(nextStats);
  };

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  const onLogMiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !groupId) return;

    setBusy(true);
    setError("");

    const milesNum = Number(miles);
    if (Number.isNaN(milesNum) || milesNum <= 0) {
      setBusy(false);
      setError("Miles must be a number greater than 0.");
      return;
    }

    const { error } = await supabase.from("entries").insert({
      group_id: groupId,
      user_id: session.user.id,
      date,
      miles: Number(milesNum.toFixed(2)),
      notes: notes.trim() ? notes.trim() : null,
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMiles("");
    setNotes("");

    await loadStats(); // triggers celebrations
  };

  if (!canShow) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!stats) return <main style={{ padding: 24 }}>Loading group…</main>;

  const groupGoal = stats.goal_miles || 250;
  const myGoal = stats.my_goal || 250;

  const groupPct = clamp(stats.group_total / groupGoal, 0, 1);
  const myPct = clamp(stats.my_total / myGoal, 0, 1);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      {/* Toasts */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 50,
          display: "grid",
          gap: 10,
          width: 340,
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--card)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 14 }}>{t.text}</div>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "2px 8px",
                  cursor: "pointer",
                  background: "transparent",
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{stats.group_name}</h1>
      {error ? <p style={{ marginTop: 12, color: "var(--danger)" }}>{error}</p> : null}

      <GroupTabs groupId={groupId!} />

      {/* Progress snapshot */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Progress</h2>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>Group total</span>
            <span>
              {formatMiles(stats.group_total)} / {formatMiles(groupGoal)}
            </span>
          </div>
          <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: "var(--border)" }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                width: `${(groupPct * 100).toFixed(1)}%`,
                background: "var(--muted)",
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
          <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: "var(--border)" }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                width: `${(myPct * 100).toFixed(1)}%`,
                background: "var(--muted)",
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
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          Refresh
        </button>
      </section>

      {/* Log miles */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log miles</h2>

        <form onSubmit={onLogMiles} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Miles</span>
            <input
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              inputMode="decimal"
              placeholder="e.g., 3.25"
              required
              style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Notes (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trail name, location, etc."
              style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
          >
            {busy ? "Saving…" : "Add entry"}
          </button>
        </form>
      </section>

      <div style={{ marginTop: 12, fontSize: 14, color: "#666" }}>
        Milestones and celebrations will appear here after you add miles.
      </div>
    </main>
  );
}
