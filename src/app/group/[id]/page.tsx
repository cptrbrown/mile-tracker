"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ---------- Types ---------- */

type GroupStats = {
  group_id: string;
  group_name: string;
  goal_miles: number;
  group_total: number;
  my_total: number;
  my_goal: number;
};

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_miles: number;
};

type FeedRow = {
  entry_id: string;
  date: string; // YYYY-MM-DD
  miles: number;
  notes: string | null;
  user_id: string;
  display_name: string;
  created_at: string;
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

  const list = BASE_MILESTONES
    .map((m) => (m === 250 ? t : m))
    .filter((m) => m > 0 && m <= t);

  return Array.from(new Set(list)).sort((a, b) => a - b);
}

function nextMilestone(milestones: number[], total: number) {
  return milestones.find((m) => total < m) ?? null;
}

function crossedMilestones(prev: number, curr: number, milestones: number[]) {
  return milestones.filter((m) => prev < m && curr >= m);
}

/* ---------- Component ---------- */

export default function GroupPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Celebrations
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const prevTotalsRef = useRef<{ group: number; mine: number } | null>(null);

  // Log form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [miles, setMiles] = useState("");
  const [notes, setNotes] = useState("");

  // Personal goal editor
  const [goalEdit, setGoalEdit] = useState<string>("");

  // Entry editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editMiles, setEditMiles] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  /* ---------- Auth guard ---------- */

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const canShow = useMemo(
    () => !loading && !!session && !!groupId,
    [loading, session, groupId]
  );

  /* ---------- Toast helpers ---------- */

  const pushToast = (text: string) => {
    const id =
      (
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random()}`
      ).toString();

    setToasts((prev) => [...prev, { id, text }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /* ---------- Loaders ---------- */

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
    setGoalEdit((prev) => (prev === "" ? String(nextStats.my_goal) : prev));
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

  const loadFeed = async () => {
    if (!groupId) return;
    setError("");

    const { data, error } = await supabase.rpc("get_group_feed", {
      gid: groupId,
      max_rows: 50,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setFeed(
      (data ?? []).map((r: any) => ({
        entry_id: r.entry_id,
        date: r.date,
        miles: Number(r.miles),
        notes: r.notes ?? null,
        user_id: r.user_id,
        display_name: r.display_name,
        created_at: r.created_at,
      }))
    );
  };

  /* ---------- Initial load ---------- */

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    loadLeaderboard();
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  /* ---------- Celebrations when totals change ---------- */

  useEffect(() => {
    if (!stats) return;

    const prev = prevTotalsRef.current;
    if (!prev) {
      prevTotalsRef.current = { group: stats.group_total, mine: stats.my_total };
      return;
    }

    const groupGoal = stats.goal_miles || 250;
    const myGoal = stats.my_goal || 250;

    const groupMilestones = buildMilestones(groupGoal);
    const myMilestones = buildMilestones(myGoal);

    const groupWentUp = stats.group_total > prev.group;
    const mineWentUp = stats.my_total > prev.mine;

    if (groupWentUp) {
      crossedMilestones(prev.group, stats.group_total, groupMilestones).forEach((m) =>
        pushToast(`🎉 Group earned the ${m}-mile badge!`)
      );
      if (prev.group < groupGoal && stats.group_total >= groupGoal) {
        pushToast(`🏁 Group goal achieved: ${formatMiles(groupGoal)} miles!`);
      }
    }

    if (mineWentUp) {
      crossedMilestones(prev.mine, stats.my_total, myMilestones).forEach((m) =>
        pushToast(`🏅 You earned the ${m}-mile badge!`)
      );
      if (prev.mine < myGoal && stats.my_total >= myGoal) {
        pushToast(`🏆 You hit your goal: ${formatMiles(myGoal)} miles!`);
      }
    }

    prevTotalsRef.current = { group: stats.group_total, mine: stats.my_total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.group_total, stats?.my_total, stats?.goal_miles, stats?.my_goal]);

  /* ---------- Actions ---------- */

  const refreshAll = async () => {
    await loadStats();
    await loadLeaderboard();
    await loadFeed();
  };

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

    await refreshAll();
  };

  const onSavePersonalGoal = async () => {
    if (!session) return;

    const g = Number(goalEdit);
    if (Number.isNaN(g) || g <= 0) {
      setError("Your goal must be a number greater than 0.");
      return;
    }

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({ personal_goal_miles: Number(g.toFixed(2)) })
      .eq("id", session.user.id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    await loadStats();
    pushToast(`🎯 Personal goal updated to ${formatMiles(g)} miles`);
  };

  const startEdit = (entry: FeedRow) => {
    setEditingId(entry.entry_id);
    setEditDate(entry.date);
    setEditMiles(String(entry.miles));
    setEditNotes(entry.notes ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDate("");
    setEditMiles("");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (!session || !editingId) return;

    const milesNum = Number(editMiles);
    if (Number.isNaN(milesNum) || milesNum <= 0) {
      setError("Miles must be a number greater than 0.");
      return;
    }

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("entries")
      .update({
        date: editDate,
        miles: Number(milesNum.toFixed(2)),
        notes: editNotes.trim() ? editNotes.trim() : null,
      })
      .eq("id", editingId)
      .eq("user_id", session.user.id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    cancelEdit();
    await refreshAll();
    pushToast("✏️ Entry updated");
  };

  const deleteEntry = async (entryId: string) => {
    if (!session) return;

    const ok = confirm("Delete this entry? This cannot be undone.");
    if (!ok) return;

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", session.user.id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshAll();
    pushToast("🗑️ Entry deleted");
  };

  /* ---------- Render ---------- */

  if (!canShow) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!stats) return <main style={{ padding: 24 }}>Loading group…</main>;

  const groupGoal = stats.goal_miles || 250;
  const myGoal = stats.my_goal || 250;

  const groupPct = clamp(stats.group_total / groupGoal, 0, 1);
  const myPct = clamp(stats.my_total / myGoal, 0, 1);

  const groupMilestones = buildMilestones(groupGoal);
  const myMilestones = buildMilestones(myGoal);

  const nextGroup = nextMilestone(groupMilestones, stats.group_total);
  const nextMine = nextMilestone(myMilestones, stats.my_total);

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

      {/* Progress */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
        }}
      >
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
                background: "var(--text)",
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
      </section>

      {/* Leaderboard */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
        }}
      >
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
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isMe ? "var(--card2)" : "transparent", // ✅ FIXED
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

      {/* Log miles */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log miles</h2>

        <form onSubmit={onLogMiles} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--card)",
                color: "var(--text)",
              }}
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
              style={{
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--card)",
                color: "var(--text)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Notes (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trail name, location, etc."
              style={{
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--card)",
                color: "var(--text)",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              background: "var(--card2)",
              color: "var(--text)",
            }}
          >
            {busy ? "Saving…" : "Add entry"}
          </button>
        </form>
      </section>

      {/* Badges */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
        }}
      >
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
      </section>

      {/* Activity feed */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Activity feed</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {feed.length === 0 ? (
            <p>No activity yet. Add your first entry above!</p>
          ) : (
            feed.map((e) => {
              const isMe = session?.user.id === e.user_id;
              const isEditing = editingId === e.entry_id;

              return (
                <div
                  key={e.entry_id}
                  style={{
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "transparent",
                  }}
                >
                  {!isEditing ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {e.display_name}
                            {isMe ? " (you)" : ""}
                          </div>
                          <div style={{ fontSize: 14, marginTop: 2 }}>{e.date}</div>
                        </div>
                        <div style={{ fontWeight: 600 }}>{formatMiles(e.miles)} mi</div>
                      </div>

                      {e.notes ? <div style={{ marginTop: 8, fontSize: 14 }}>{e.notes}</div> : null}

                      {isMe ? (
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button
                            onClick={() => startEdit(e)}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--card2)",
                              color: "var(--text)",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(e.entry_id)}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--card2)",
                              color: "var(--text)",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Date</span>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(ev) => setEditDate(ev.target.value)}
                            style={{
                              padding: 10,
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--card)",
                              color: "var(--text)",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Miles</span>
                          <input
                            value={editMiles}
                            onChange={(ev) => setEditMiles(ev.target.value)}
                            inputMode="decimal"
                            style={{
                              padding: 10,
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--card)",
                              color: "var(--text)",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Notes</span>
                          <input
                            value={editNotes}
                            onChange={(ev) => setEditNotes(ev.target.value)}
                            style={{
                              padding: 10,
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--card)",
                              color: "var(--text)",
                            }}
                          />
                        </label>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button
                          onClick={saveEdit}
                          disabled={busy}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "var(--card2)",
                            color: "var(--text)",
                          }}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "transparent",
                            color: "var(--text)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
