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

type FeedRow = {
  entry_id: string;
  date: string;
  miles: number;
  notes: string | null;
  user_id: string;
  display_name: string;
  created_at: string;
};

function formatMiles(n: number) {
  return Number(n).toFixed(2);
}

export default function FeedPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Entry editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editMiles, setEditMiles] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

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

    setStats({ group_id: row.group_id, group_name: row.group_name });
  };

  const loadFeed = async () => {
    if (!groupId) return;
    setError("");

    const { data, error } = await supabase.rpc("get_group_feed", {
      gid: groupId,
      max_rows: 100,
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

  useEffect(() => {
    if (!session || !groupId) return;
    loadStats();
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  const refresh = async () => {
    await loadFeed();
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
    await refresh();
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

    await refresh();
  };

  if (!canShow) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!stats) return <main style={{ padding: 24 }}>Loading group…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{stats.group_name}</h1>
      {error ? <p style={{ marginTop: 12, color: "crimson" }}>{error}</p> : null}

      <GroupTabs groupId={groupId!} />

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Activity feed</h2>
          <button
            onClick={refresh}
            disabled={busy}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 10, cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {feed.length === 0 ? (
            <p>No activity yet. Add your first entry in the Log tab!</p>
          ) : (
            feed.map((e) => {
              const isMe = session?.user.id === e.user_id;
              const isEditing = editingId === e.entry_id;

              return (
                <div key={e.entry_id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
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
                            style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 8 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(e.entry_id)}
                            style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 8 }}
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
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Miles</span>
                          <input
                            value={editMiles}
                            onChange={(ev) => setEditMiles(ev.target.value)}
                            inputMode="decimal"
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Notes</span>
                          <input
                            value={editNotes}
                            onChange={(ev) => setEditNotes(ev.target.value)}
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </label>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button
                          onClick={saveEdit}
                          disabled={busy}
                          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 8 }}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 8 }}
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
