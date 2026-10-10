"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Identity, StaleDraft } from "./shared";

interface RankedEntry {
  id: number;
  name: string;
}

export function RankingEditor({
  entries,
  revision,
  pending,
  kind,
  onSave,
  onCancel,
}: {
  entries: RankedEntry[];
  revision: number;
  pending: boolean;
  kind: "keepers" | "agents";
  onSave: (ids: number[], revision: number) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({ entries: [...entries], revision });
  const [announcement, setAnnouncement] = useState("");
  const [dragged, setDragged] = useState<number | null>(null);
  const stale = revision !== draft.revision;
  function move(from: number, to: number) {
    if (pending || stale || from < 0 || to < 0 || to >= draft.entries.length)
      return;
    const next = [...draft.entries];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    setDraft({ ...draft, entries: next });
    setAnnouncement(`${entry.name} moved to rank ${to + 1}.`);
  }
  return (
    <section>
      <div className="sheet-toolbar">
        <div>
          <h2>Edit {kind === "keepers" ? "Groundskeeper" : "agent"} ranking</h2>
          <p className="sheet-muted">
            Drag the handle or use the arrows. Save to apply this order
            everywhere.
          </p>
        </div>
        <div className="sheet-actions">
          <button
            className="sheet-button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="sheet-button sheet-primary"
            disabled={pending || stale}
            onClick={() => {
              void onSave(
                draft.entries.map((e) => e.id),
                draft.revision,
              )
                .then(onCancel)
                .catch(() => {});
            }}
          >
            {pending ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
      <StaleDraft
        stale={stale}
        reload={() => setDraft({ entries: [...entries], revision })}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      <div className="sheet-scroll">
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="sheet-rank">Rank</th>
              <th>{kind === "keepers" ? "Groundskeeper" : "Agent"}</th>
              <th className="sheet-end">Order</th>
            </tr>
          </thead>
          <tbody>
            {draft.entries.map((entry, index) => (
              <tr
                key={entry.id}
                className={dragged === entry.id ? "sheet-dragging" : undefined}
                onDragOver={(e) => {
                  if (dragged !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draft.entries.findIndex((v) => v.id === dragged);
                  if (from >= 0) move(from, index);
                  setDragged(null);
                }}
              >
                <td className="sheet-rank">{index + 1}</td>
                <td>
                  <Identity name={entry.name} />
                </td>
                <td>
                  <div className="sheet-order-buttons">
                    <button
                      type="button"
                      className="sheet-icon-button sheet-drag-handle"
                      draggable={!pending && !stale}
                      disabled={pending || stale}
                      aria-label={`Drag ${entry.name} to reorder`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", String(entry.id));
                        e.dataTransfer.effectAllowed = "move";
                        setDragged(entry.id);
                      }}
                      onDragEnd={() => setDragged(null)}
                    >
                      <GripVertical size={16} />
                    </button>
                    <button
                      className="sheet-icon-button"
                      aria-label={`Move ${entry.name} up`}
                      disabled={index === 0 || pending || stale}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="sheet-icon-button"
                      aria-label={`Move ${entry.name} down`}
                      disabled={
                        index === draft.entries.length - 1 || pending || stale
                      }
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
