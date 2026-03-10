"use client";

import { useState } from "react";
import { HazardEditor } from "./hazard-editor";
import type { HoleHazard, OfficialHoleNote, PlayerHoleNote } from "@/lib/db/types";

interface HoleRowProps {
  holeNumber: number;
  par: number;
  yardage: number;
  si: number;
  /** 数据库中的洞 ID，未保存时为 null */
  holeId: string | null;
  hazards: HoleHazard[];
  courseId: string;
  officialNote: OfficialHoleNote | null;
  onChange: (data: { par: number; yardage: number; si: number }) => void;
  onHazardsChange: (hazards: HoleHazard[]) => void;
  onOfficialNoteSave: (note: OfficialHoleNote | null) => void;
}

const PAR_OPTIONS = [3, 4, 5];

/** 单个球洞行：Hole# → Par → Yards → SI → Notes → Hazards */
export function HoleRow({
  holeNumber,
  par,
  yardage,
  si,
  holeId,
  hazards,
  courseId,
  officialNote,
  onChange,
  onHazardsChange,
  onOfficialNoteSave,
}: HoleRowProps) {
  const [showNotes, setShowNotes] = useState(!!(officialNote?.note));

  // Official note local state
  const [officialDraft, setOfficialDraft] = useState(officialNote?.note ?? "");
  const [savingOfficial, setSavingOfficial] = useState(false);

  // Player notes
  const [playerNotes, setPlayerNotes] = useState<PlayerHoleNote[] | null>(null);
  const [loadingPlayerNotes, setLoadingPlayerNotes] = useState(false);
  const [playerDraft, setPlayerDraft] = useState("");
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function saveOfficialNote() {
    if (officialDraft === (officialNote?.note ?? "")) return;
    setSavingOfficial(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/official-notes/${holeNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: officialDraft }),
        }
      );
      if (res.status === 204) {
        onOfficialNoteSave(null);
      } else if (res.ok) {
        const saved = (await res.json()) as OfficialHoleNote;
        onOfficialNoteSave(saved);
      }
    } catch {
      // 静默
    } finally {
      setSavingOfficial(false);
    }
  }

  async function loadPlayerNotes() {
    if (!holeId || playerNotes !== null) return;
    setLoadingPlayerNotes(true);
    try {
      const res = await fetch(`/api/courses/holes/${holeId}/player-notes`);
      if (res.ok) {
        setPlayerNotes((await res.json()) as PlayerHoleNote[]);
      }
    } catch {
      setPlayerNotes([]);
    } finally {
      setLoadingPlayerNotes(false);
    }
  }

  async function handleToggleNotes() {
    const next = !showNotes;
    setShowNotes(next);
    if (next) await loadPlayerNotes();
  }

  async function submitPlayerNote() {
    if (!holeId || !playerDraft.trim()) return;
    setSavingPlayer(true);
    try {
      const res = await fetch(`/api/courses/holes/${holeId}/player-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: playerDraft.trim() }),
      });
      if (res.ok) {
        const saved = (await res.json()) as PlayerHoleNote;
        setPlayerNotes((prev) => {
          if (!prev) return [saved];
          // upsert: replace if same user, else append
          const idx = prev.findIndex((n) => n.is_mine);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
        setPlayerDraft("");
      }
    } catch {
      // 静默
    } finally {
      setSavingPlayer(false);
    }
  }

  async function startEditPlayerNote(note: PlayerHoleNote) {
    setEditingNoteId(note.id);
    setEditDraft(note.note);
  }

  async function saveEditedPlayerNote() {
    if (!holeId || !editingNoteId || !editDraft.trim()) return;
    setSavingPlayer(true);
    try {
      const res = await fetch(`/api/courses/holes/${holeId}/player-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editDraft.trim() }),
      });
      if (res.ok) {
        const saved = (await res.json()) as PlayerHoleNote;
        setPlayerNotes((prev) =>
          prev ? prev.map((n) => (n.id === editingNoteId ? saved : n)) : [saved]
        );
        setEditingNoteId(null);
        setEditDraft("");
      }
    } catch {
      // 静默
    } finally {
      setSavingPlayer(false);
    }
  }

  async function deletePlayerNote(noteId: string) {
    if (!holeId) return;
    try {
      const res = await fetch(
        `/api/courses/holes/${holeId}/player-notes/${noteId}`,
        { method: "DELETE" }
      );
      if (res.ok || res.status === 204) {
        setPlayerNotes((prev) => prev ? prev.filter((n) => n.id !== noteId) : null);
      }
    } catch {
      // 静默
    }
  }

  const hasNoteContent = !!(officialNote?.note);
  const hasPlayerNotes = playerNotes && playerNotes.length > 0;

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-divider last:border-b-0">
      {/* 主行：Hole# | Par toggles | Yardage | SI | Notes toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 洞号 */}
        <span className="text-[0.9375rem] font-semibold text-text w-10 shrink-0">
          #{holeNumber}
        </span>

        {/* Par 选择 */}
        <div className="flex items-center gap-1">
          <span className="text-[0.75rem] text-secondary mr-0.5">Par</span>
          {PAR_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => onChange({ par: p, yardage, si })}
              className={`
                w-9 h-9 rounded-md
                text-[0.875rem] font-medium transition-colors cursor-pointer
                ${
                  par === p
                    ? "bg-accent text-white"
                    : "bg-white border border-divider text-text hover:bg-gray-50"
                }
              `}
            >
              {p}
            </button>
          ))}
        </div>

        {/* 码数输入 */}
        <div className="flex items-center gap-1">
          <span className="text-[0.75rem] text-secondary">Yds</span>
          <input
            type="number"
            value={yardage || ""}
            onChange={(e) =>
              onChange({ par, yardage: parseInt(e.target.value, 10) || 0, si })
            }
            placeholder="—"
            className="w-16 rounded-md border border-divider px-2 py-2 text-[0.875rem] text-text text-center placeholder:text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Stroke Index 输入 */}
        <div className="flex items-center gap-1">
          <span className="text-[0.75rem] text-secondary">SI</span>
          <input
            type="number"
            min={1}
            max={18}
            value={si || ""}
            onChange={(e) =>
              onChange({ par, yardage, si: parseInt(e.target.value, 10) || 0 })
            }
            placeholder="—"
            className="w-14 rounded-md border border-divider px-2 py-2 text-[0.875rem] text-text text-center placeholder:text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Notes 切换按钮 */}
        <button
          onClick={handleToggleNotes}
          className={`
            w-9 h-9 rounded-md flex items-center justify-center relative
            transition-colors cursor-pointer
            ${showNotes || hasNoteContent ? "text-accent" : "text-secondary hover:text-text"}
          `}
          title={showNotes ? "Hide notes" : "Show notes"}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 13.5V15H4.5L12.06 7.44L10.56 5.94L3 13.5ZM14.46 5.04C14.61 4.89 14.61 4.64 14.46 4.49L13.01 3.04C12.86 2.89 12.61 2.89 12.46 3.04L11.69 3.81L13.19 5.31L14.46 5.04Z"
              fill="currentColor"
            />
          </svg>
          {/* dot indicator when there's content */}
          {(hasNoteContent || hasPlayerNotes) && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {/* Notes 展开区 */}
      {showNotes && (
        <div className="ml-10 flex flex-col gap-4">

          {/* ── Course Note (official, shared) ── */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold text-secondary uppercase tracking-wide">
              Course Note
              <span className="ml-1.5 font-normal normal-case text-[0.6875rem] text-secondary/70">
                shared across all tees
              </span>
            </span>
            <textarea
              rows={2}
              value={officialDraft}
              onChange={(e) => setOfficialDraft(e.target.value)}
              onBlur={saveOfficialNote}
              placeholder="e.g. Dogleg right, aim for the bunker on the left…"
              className="w-full rounded-md border border-divider px-2.5 py-2 text-[0.8125rem] text-text placeholder:text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
            />
            {savingOfficial && (
              <span className="text-[0.75rem] text-secondary">Saving…</span>
            )}
          </div>

          {/* ── Player Notes ── */}
          <div className="flex flex-col gap-2">
            <span className="text-[0.6875rem] font-semibold text-secondary uppercase tracking-wide">
              Player Notes
              <span className="ml-1.5 font-normal normal-case text-[0.6875rem] text-secondary/70">
                your own + others' tips
              </span>
            </span>

            {!holeId ? (
              <p className="text-[0.75rem] text-secondary italic">
                Save the scorecard first to unlock player notes.
              </p>
            ) : loadingPlayerNotes ? (
              <p className="text-[0.75rem] text-secondary">Loading…</p>
            ) : (
              <>
                {/* Existing player notes */}
                {playerNotes && playerNotes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {playerNotes.map((pn) => (
                      <div
                        key={pn.id}
                        className="rounded-md border border-divider bg-bg px-3 py-2 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[0.75rem] font-medium text-text">
                            {pn.user_name || "Anonymous"}
                          </span>
                          {pn.is_mine && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditPlayerNote(pn)}
                                className="text-[0.6875rem] text-accent hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deletePlayerNote(pn.id)}
                                className="text-[0.6875rem] text-red-400 hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {editingNoteId === pn.id ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea
                              autoFocus
                              rows={2}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="w-full rounded-md border border-accent px-2 py-1.5 text-[0.8125rem] text-text outline-none focus:ring-1 focus:ring-accent resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEditedPlayerNote}
                                disabled={savingPlayer}
                                className="text-[0.75rem] text-accent font-medium hover:underline cursor-pointer"
                              >
                                {savingPlayer ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={() => { setEditingNoteId(null); setEditDraft(""); }}
                                className="text-[0.75rem] text-secondary hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[0.8125rem] text-text">{pn.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add my note (only if user doesn't have one yet) */}
                {playerNotes !== null && !playerNotes.some((n) => n.is_mine) && (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      rows={2}
                      value={playerDraft}
                      onChange={(e) => setPlayerDraft(e.target.value)}
                      placeholder="Add your tip for this hole…"
                      className="w-full rounded-md border border-divider px-2.5 py-2 text-[0.8125rem] text-text placeholder:text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                    />
                    {playerDraft.trim() && (
                      <button
                        onClick={submitPlayerNote}
                        disabled={savingPlayer}
                        className="self-end text-[0.8125rem] text-accent font-medium hover:underline cursor-pointer"
                      >
                        {savingPlayer ? "Saving…" : "Post note"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 障碍物 — Save 后解锁 */}
      <div className="ml-10">
        <HazardEditor
          holeId={holeId}
          hazards={hazards}
          onHazardsChange={onHazardsChange}
        />
      </div>
    </div>
  );
}
