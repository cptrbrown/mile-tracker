"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import GroupTabs from "../GroupTabs";

type Difficulty = "easy" | "moderate" | "moderate_plus" | "hard" | "strenuous";
type RSVP = "going" | "maybe" | "no";

type EventRow = {
  event_id: string;
  title: string;
  start_at: string; // ISO
  location: string | null;
  distance_miles: number | null;
  difficulty: Difficulty;
  notes: string | null;
  created_by: string;
  created_by_name: string;
  going_count: number;
  maybe_count: number;
  no_count: number;
  my_status: RSVP | null;
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  moderate_plus: "Moderate +",
  hard: "Hard",
  strenuous: "Strenuous",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// datetime-local expects "YYYY-MM-DDTHH:mm"
function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function GroupHikesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();

  const groupId = params?.id;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d.toISOString());
  });
  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [notes, setNotes] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDistance, setEditDistance] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>("moderate");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const canShow = useMemo(() => !loading && !!session && !!groupId, [loading, session, groupId]);

  const loadEvents = async () => {
    if (!groupId) return;
    setError("");

    const { data, error } = await supabase.rpc("get_group_events", {
      p_gid: groupId,
      p_limit: 100,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setEvents(
      (data ?? []).map((r: any) => ({
        event_id: r.event_id,
        title: r.title,
        start_at: r.start_at,
        location: r.location ?? null,
        distance_miles: r.distance_miles === null ? null : Number(r.distance_miles),
        difficulty: r.difficulty,
        notes: r.notes ?? null,
        created_by: r.created_by,
        created_by_name: r.created_by_name,
        going_count: Number(r.going_count ?? 0),
        maybe_count: Number(r.maybe_count ?? 0),
        no_count: Number(r.no_count ?? 0),
        my_status: r.my_status ?? null,
      }))
    );
  };

  useEffect(() => {
    if (!session || !groupId) return;
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, groupId]);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !groupId) return;

    setError("");
    setBusy(true);

    if (!title.trim()) {
      setBusy(false);
      setError("Please enter a title.");
      return;
    }

    const startIso = new Date(startAt).toISOString();

    const distNum = distance.trim() ? Number(distance) : null;
    if (distance.trim() && (Number.isNaN(distNum) || (distNum ?? 0) <= 0)) {
      setBusy(false);
      setError("Distance must be a number greater than 0 (or leave blank).");
      return;
    }

    const { error } = await supabase.from("group_events").insert({
      group_id: groupId,
      created_by: session.user.id,
      title: title.trim(),
      start_at: startIso,
      location: location.trim() ? location.trim() : null,
      distance_miles: distNum === null ? null : Number(distNum.toFixed(2)),
      difficulty,
      notes: notes.trim() ? notes.trim() : null,
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTitle("");
    setLocation("");
    setDistance("");
    setDifficulty("moderate");
    setNotes("");

    await loadEvents();
  };

  const setMyRsvp = async (eventId: string, status: RSVP) => {
    if (!session) return;

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("group_event_rsvps")
      .upsert({ event_id: eventId, user_id: session.user.id, status }, { onConflict: "event_id,user_id" });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    await loadEvents();
  };

  const startEdit = (ev: EventRow) => {
    setEditingId(ev.event_id);
    setEditTitle(ev.title);
    setEditStartAt(toLocalInputValue(ev.start_at));
    setEditLocation(ev.location ?? "");
    setEditDistance(ev.distance_miles === null ? "" : String(ev.distance_miles));
    setEditDifficulty(ev.difficulty);
    setEditNotes(ev.notes ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditStartAt("");
    setEditLocation("");
    setEditDistance("");
    setEditDifficulty("moderate");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (!session || !editingId) return;

    setBusy(true);
    setError("");

    if (!editTitle.trim()) {
      setBusy(false);
      setError("Title is required.");
      return;
    }

    const startIso = new Date(editStartAt).toISOString();

    const distNum = editDistance.trim() ? Number(editDistance) : null;
    if (editDistance.trim() && (Number.isNaN(distNum) || (distNum ?? 0) <= 0)) {
      setBusy(false);
      setError("Distance must be a number greater than 0 (or leave blank).");
      return;
    }

    const { error } = await supabase
      .from("group_events")
      .update({
        title: editTitle.trim(),
        start_at: startIso,
        location: editLocation.trim() ? editLocation.trim() : null,
        distance_miles: distNum === null ? null : Number(distNum.toFixed(2)),
        difficulty: editDifficulty,
        notes: editNotes.trim() ? editNotes.trim() : null,
      })
      .eq("id", editingId);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    cancelEdit();
    await loadEvents();
  };

  const deleteEvent = async (eventId: string) => {
    const ok = confirm("Delete this hike? This cannot be undone.");
    if (!ok) return;

    setBusy(true);
    setError("");

    const { error } = await supabase.from("group_events").delete().eq("id", eventId);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (editingId === eventId) cancelEdit();
    await loadEvents();
  };

  const buttonSecondary =
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

  const inputBase =
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none " +
    "focus:ring-2 focus:ring-black/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-white/10";

  const card =
    "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  const rsvpBtn = (active: boolean) =>
    [
      "rounded-xl border px-3 py-2 text-sm font-medium",
      active
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800",
      busy ? "opacity-70" : "",
    ].join(" ");

  if (!canShow) return <main className="px-4 py-6 text-zinc-900 dark:text-zinc-100">Loading…</main>;

  // Group by day
  const grouped = events.reduce<Record<string, EventRow[]>>((acc, ev) => {
    const k = groupKey(ev.start_at);
    acc[k] = acc[k] ? [...acc[k], ev] : [ev];
    return acc;
  }, {});

  const dayKeys = Object.keys(grouped);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-zinc-900 dark:text-zinc-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hikes</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Schedule hikes for the group and RSVP.
          </p>
        </div>

        <button onClick={() => router.push(`/group/${groupId}`)} className={buttonSecondary}>
          Back
        </button>
      </div>

      <div className="mt-3">
        <GroupTabs groupId={groupId!} />
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {/* Create hike */}
      <section className={`mt-4 ${card}`}>
        <h2 className="text-lg font-semibold">Schedule a hike</h2>

        <form onSubmit={createEvent} className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Bear Mountain loop"
              className={inputBase}
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Date & time</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputBase} required />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Location / meetup spot</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" className={inputBase} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Distance (miles)</span>
              <input
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                inputMode="decimal"
                placeholder="Optional"
                className={inputBase}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={inputBase}>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="moderate_plus">Moderate +</option>
                <option value="hard">Hard</option>
                <option value="strenuous">Strenuous</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details (trailhead, gear, etc.)"
              className={inputBase}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {busy ? "Saving…" : "Add hike"}
          </button>
        </form>
      </section>

      {/* Upcoming list */}
      <section className={`mt-4 ${card}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <button onClick={loadEvents} disabled={busy} className={buttonSecondary}>
            Refresh
          </button>
        </div>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No hikes scheduled yet.</p>
        ) : (
          <div className="mt-4 grid gap-5">
            {dayKeys.map((day) => (
              <div key={day}>
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{day}</div>

                <div className="mt-2 grid gap-3">
                  {grouped[day].map((ev) => {
                    const isMe = session?.user.id === ev.created_by;
                    const isEditing = editingId === ev.event_id;
                    const difficultyLabel = DIFFICULTY_LABELS[ev.difficulty];

                    return (
                      <div key={ev.event_id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/20">
                        {!isEditing ? (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-base font-semibold">{ev.title}</div>
                                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                                  {formatDateTime(ev.start_at)} • {difficultyLabel}
                                  {ev.distance_miles !== null ? ` • ${ev.distance_miles.toFixed(2)} mi` : ""}
                                </div>
                                {ev.location ? (
                                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{ev.location}</div>
                                ) : null}
                                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  Added by {ev.created_by_name}
                                  {isMe ? " (you)" : ""}
                                </div>
                              </div>

                              {isMe ? (
                                <div className="flex gap-2">
                                  <button onClick={() => startEdit(ev)} className={buttonSecondary}>
                                    Edit
                                  </button>
                                  <button onClick={() => deleteEvent(ev.event_id)} className={buttonSecondary}>
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            {ev.notes ? <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">{ev.notes}</div> : null}

                            {/* RSVP */}
                            <div className="mt-4">
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Going: {ev.going_count} • Maybe: {ev.maybe_count} • No: {ev.no_count}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <button onClick={() => setMyRsvp(ev.event_id, "going")} disabled={busy} className={rsvpBtn(ev.my_status === "going")}>
                                  Going
                                </button>
                                <button onClick={() => setMyRsvp(ev.event_id, "maybe")} disabled={busy} className={rsvpBtn(ev.my_status === "maybe")}>
                                  Maybe
                                </button>
                                <button onClick={() => setMyRsvp(ev.event_id, "no")} disabled={busy} className={rsvpBtn(ev.my_status === "no")}>
                                  No
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-base font-semibold">Edit hike</div>

                            <div className="mt-3 grid gap-3">
                              <label className="grid gap-1">
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">Title</span>
                                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputBase} />
                              </label>

                              <label className="grid gap-1">
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">Date & time</span>
                                <input
                                  type="datetime-local"
                                  value={editStartAt}
                                  onChange={(e) => setEditStartAt(e.target.value)}
                                  className={inputBase}
                                />
                              </label>

                              <label className="grid gap-1">
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">Location</span>
                                <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className={inputBase} />
                              </label>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-300">Distance (miles)</span>
                                  <input
                                    value={editDistance}
                                    onChange={(e) => setEditDistance(e.target.value)}
                                    inputMode="decimal"
                                    className={inputBase}
                                  />
                                </label>

                                <label className="grid gap-1">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-300">Difficulty</span>
                                  <select
                                    value={editDifficulty}
                                    onChange={(e) => setEditDifficulty(e.target.value as Difficulty)}
                                    className={inputBase}
                                  >
                                    <option value="easy">Easy</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="moderate_plus">Moderate +</option>
                                    <option value="hard">Hard</option>
                                    <option value="strenuous">Strenuous</option>
                                  </select>
                                </label>
                              </div>

                              <label className="grid gap-1">
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">Notes</span>
                                <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputBase} />
                              </label>
                            </div>

                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={busy}
                                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                              >
                                {busy ? "Saving…" : "Save"}
                              </button>
                              <button onClick={cancelEdit} className={buttonSecondary}>
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
