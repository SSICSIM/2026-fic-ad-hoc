"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useMechanics } from "@/hooks/useMechanics";
import type {
  Agent,
  Keeper,
  MechanicsAction,
  MechanicsSnapshot,
} from "@/types/mechanics";
import {
  AgentOptions,
  EmptySheet,
  Identity,
  QueryState,
  StaleDraft,
} from "./shared";

type Save = (action: MechanicsAction, revision: number) => Promise<unknown>;
interface PanelProps {
  data: MechanicsSnapshot;
  pending: boolean;
  save: Save;
}

export function ControlPanel() {
  const { data, isPending, error, refetch, mutation } = useMechanics();
  const [tab, setTab] = useState("agents");
  if (!data)
    return (
      <QueryState
        loading={isPending}
        error={error}
        retry={() => void refetch()}
      />
    );
  const props: PanelProps = {
    data,
    pending: mutation.isPending,
    save: (action, revision) => mutation.mutateAsync({ ...action, revision }),
  };
  return (
    <main className="mechanics-shell">
      <div className="sheet-page-heading">
        <div>
          <p className="sheet-eyebrow">REGISTER SETUP</p>
          <h1>Control panel</h1>
          <p className="sheet-muted">
            Add your agents, enter Groundskeepers, then build their rosters.
          </p>
        </div>
        <Link className="sheet-button" href="/mechanics">
          <ArrowLeft size={15} /> Back to register
        </Link>
      </div>
      <div className="sheet-workbook">
        <nav className="sheet-tabs" aria-label="Control panel sections">
          {[
            ["agents", "Agents"],
            ["keepers", "Groundskeepers"],
            ["rosters", "Build rosters"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                mutation.reset();
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sheet-content">
          {(error || mutation.error) && (
            <div className="sheet-notice sheet-error" role="alert">
              {mutation.error?.message || error?.message}
            </div>
          )}
          {tab === "agents" && <AgentPanel {...props} />}
          {tab === "keepers" && <KeeperPanel {...props} />}
          {tab === "rosters" && <RosterPanel {...props} />}
        </div>
        <footer className="sheet-status">
          <span>
            Agents also appear in the crisis tracker’s character list.
          </span>
          <span role="status">
            {mutation.isPending ? "Saving…" : "Staff access"}
          </span>
        </footer>
      </div>
    </main>
  );
}

function AgentPanel({ data, pending, save }: PanelProps) {
  const [draft, setDraft] = useState<{
    id?: number;
    name: string;
    delegate_name: string;
    revision: number;
  } | null>(null);
  const [removing, setRemoving] = useState<(Agent & { revision: number }) | null>(null);
  function edit(agent?: Agent) {
    setDraft({
      id: agent?.id,
      name: agent?.name ?? "",
      delegate_name: agent?.delegate_name ?? "",
      revision: data.revision,
    });
  }
  return (
    <>
      <div className="sheet-toolbar">
        <div>
          <h2>Agents</h2>
          <p className="sheet-muted">
            Each agent is one delegate’s character. New entries go to the bottom
            of the ranking.
          </p>
        </div>
        <button
          className="sheet-button sheet-primary"
          disabled={pending}
          onClick={() => edit()}
        >
          <Plus size={15} /> Add agent
        </button>
      </div>
      {draft && (
        <form
          className="sheet-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                type: "save_agent",
                id: draft.id,
                name: draft.name,
                delegate_name: draft.delegate_name,
              },
              draft.revision,
            )
              .then(() => setDraft(null))
              .catch(() => {});
          }}
        >
          <h3>{draft.id ? "Edit agent" : "New agent"}</h3>
          <StaleDraft
            stale={draft.revision !== data.revision}
            reload={() => {
              if (!draft.id) return setDraft({ ...draft, revision: data.revision });
              const latest = data.agents.find((a) => a.id === draft.id);
              if (latest) edit(latest);
              else setDraft(null);
            }}
          />
          <fieldset disabled={pending} className="sheet-form-fields">
            <label>
              Agent / character name
              <input
                className="sheet-input"
                autoFocus
                required
                maxLength={255}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Delegate name <span className="sheet-muted">(optional)</span>
              <input
                className="sheet-input"
                maxLength={255}
                value={draft.delegate_name}
                onChange={(e) =>
                  setDraft({ ...draft, delegate_name: e.target.value })
                }
              />
            </label>
          </fieldset>
          <div className="sheet-actions">
            <button
              className="sheet-button sheet-primary"
              disabled={
                pending ||
                !draft.name.trim() ||
                draft.revision !== data.revision
              }
            >
              {pending ? "Saving…" : "Save agent"}
            </button>
            <button
              type="button"
              className="sheet-button"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {removing && (
        <RemoveNotice
          name={removing.name}
          pending={pending}
          cancel={() => setRemoving(null)}
          remove={() =>
            save({ type: "remove_agent", id: removing.id }, removing.revision).then(
              () => setRemoving(null),
            )
          }
        />
      )}
      {data.agents.length ? (
        <div className="sheet-scroll">
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="sheet-rank">Rank</th>
                <th>Agent</th>
                <th>Delegate</th>
                <th className="sheet-end">Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.id}>
                  <td className="sheet-rank">{a.rank}</td>
                  <td>
                    <Identity name={a.name} />
                  </td>
                  <td>{a.delegate_name || "—"}</td>
                  <td>
                    <div className="sheet-order-buttons">
                      <button
                        className="sheet-icon-button"
                        disabled={pending}
                        aria-label={`Edit ${a.name}`}
                        onClick={() => edit(a)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="sheet-icon-button"
                        disabled={pending}
                        aria-label={`Remove ${a.name}`}
                        onClick={() => setRemoving({ ...a, revision: data.revision })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !draft && (
          <EmptySheet>No agents yet. Add the first agent above.</EmptySheet>
        )
      )}
    </>
  );
}

function KeeperPanel({ data, pending, save }: PanelProps) {
  const [draft, setDraft] = useState<{
    id?: number;
    name: string;
    description: string;
    agent_id: number | null;
    revision: number;
  } | null>(null);
  const [removing, setRemoving] = useState<(Keeper & { revision: number }) | null>(null);
  function edit(keeper?: Keeper) {
    setDraft({
      id: keeper?.id,
      name: keeper?.name ?? "",
      description: keeper?.description ?? "",
      agent_id: keeper?.agent_id ?? null,
      revision: data.revision,
    });
  }
  return (
    <>
      <div className="sheet-toolbar">
        <div>
          <h2>Groundskeepers</h2>
          <p className="sheet-muted">
            Keep descriptions brief. Representation changes are recorded
            automatically.
          </p>
        </div>
        <button
          className="sheet-button sheet-primary"
          disabled={pending}
          onClick={() => edit()}
        >
          <Plus size={15} /> Add Groundskeeper
        </button>
      </div>
      {draft && (
        <form
          className="sheet-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                type: "save_keeper",
                id: draft.id,
                name: draft.name,
                description: draft.description,
                agent_id: draft.agent_id,
              },
              draft.revision,
            )
              .then(() => setDraft(null))
              .catch(() => {});
          }}
        >
          <h3>{draft.id ? "Edit Groundskeeper" : "New Groundskeeper"}</h3>
          <StaleDraft
            stale={draft.revision !== data.revision}
            reload={() => {
              if (!draft.id) return setDraft({
                ...draft,
                revision: data.revision,
                agent_id: data.agents.some((a) => a.id === draft.agent_id) ? draft.agent_id : null,
              });
              const latest = data.keepers.find((k) => k.id === draft.id);
              if (latest) edit(latest);
              else setDraft(null);
            }}
          />
          <fieldset disabled={pending} className="sheet-form-fields">
            <label>
              Name
              <input
                className="sheet-input"
                autoFocus
                required
                maxLength={255}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Agent
              <select
                className="sheet-select"
                value={draft.agent_id ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    agent_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <AgentOptions agents={data.agents} />
              </select>
            </label>
            <label className="sheet-wide-field">
              Description <span className="sheet-muted">(optional)</span>
              <textarea
                className="sheet-input"
                rows={2}
                maxLength={10000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
          </fieldset>
          <div className="sheet-actions">
            <button
              className="sheet-button sheet-primary"
              disabled={
                pending ||
                !draft.name.trim() ||
                draft.revision !== data.revision
              }
            >
              {pending ? "Saving…" : "Save Groundskeeper"}
            </button>
            <button
              type="button"
              className="sheet-button"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {removing && (
        <RemoveNotice
          name={removing.name}
          pending={pending}
          cancel={() => setRemoving(null)}
          remove={() =>
            save(
              { type: "remove_keeper", id: removing.id },
              removing.revision,
            ).then(() => setRemoving(null))
          }
        />
      )}
      {data.keepers.length ? (
        <div className="sheet-scroll">
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="sheet-rank">Rank</th>
                <th>Groundskeeper</th>
                <th>Agent</th>
                <th className="sheet-end">Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.keepers.map((k) => (
                <tr
                  key={k.id}
                  className={k.agent_id === null ? "sheet-unsigned" : undefined}
                >
                  <td className="sheet-rank">{k.rank}</td>
                  <td>
                    <Identity name={k.name} detail={k.description} />
                  </td>
                  <td>
                    {data.agents.find((a) => a.id === k.agent_id)?.name ??
                      "Unsigned"}
                  </td>
                  <td>
                    <div className="sheet-order-buttons">
                      <button
                        className="sheet-icon-button"
                        disabled={pending}
                        aria-label={`Edit ${k.name}`}
                        onClick={() => edit(k)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="sheet-icon-button"
                        disabled={pending}
                        aria-label={`Remove ${k.name}`}
                        onClick={() => setRemoving({ ...k, revision: data.revision })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !draft && (
          <EmptySheet>
            No Groundskeepers yet. Add the first Groundskeeper above.
          </EmptySheet>
        )
      )}
    </>
  );
}

function RosterPanel({ data, pending, save }: PanelProps) {
  const [agentId, setAgentId] = useState("");
  const [draft, setDraft] = useState<{
    ids: number[];
    revision: number;
  } | null>(null);
  function selectAgent(value: string) {
    setAgentId(value);
    setDraft(
      value
        ? {
            ids: data.keepers
              .filter((k) => k.agent_id === Number(value))
              .map((k) => k.id),
            revision: data.revision,
          }
        : null,
    );
  }
  const agent = data.agents.find((a) => a.id === Number(agentId));
  const transfers = data.keepers.filter(
    (k) =>
      draft?.ids.includes(k.id) &&
      k.agent_id !== null &&
      k.agent_id !== agent?.id,
  );
  return (
    <>
      <div className="sheet-toolbar">
        <div>
          <h2>Build a roster</h2>
          <p className="sheet-muted">
            Select an agent, check their Groundskeepers, then save the whole
            roster.
          </p>
        </div>
      </div>
      {!data.agents.length || !data.keepers.length ? (
        <EmptySheet>
          Add agents and Groundskeepers in the other control panel tabs first.
        </EmptySheet>
      ) : (
        <>
          <label className="sheet-roster-picker">
            Agent
            <select
              className="sheet-select"
              disabled={pending}
              value={agentId}
              onChange={(e) => selectAgent(e.target.value)}
            >
              <option value="">Choose an agent…</option>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {draft && agent && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(
                  {
                    type: "set_roster",
                    agent_id: agent.id,
                    keeper_ids: draft.ids,
                  },
                  draft.revision,
                )
                  .then(() => {
                    setDraft(null);
                    setAgentId("");
                  })
                  .catch(() => {});
              }}
            >
              <StaleDraft
                stale={draft.revision !== data.revision}
                reload={() => selectAgent(agentId)}
              />
              {transfers.length > 0 && (
                <div className="sheet-notice">
                  Saving will transfer {transfers.map((k) => k.name).join(", ")}{" "}
                  from their current representation to {agent.name}.
                </div>
              )}
              <div className="sheet-scroll">
                <table className="sheet-table">
                  <thead>
                    <tr>
                      <th className="sheet-rank">Include</th>
                      <th>Groundskeeper</th>
                      <th>Current agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keepers.map((k) => (
                      <tr key={k.id}>
                        <td className="sheet-rank">
                          <input
                            type="checkbox"
                            className="sheet-checkbox"
                            disabled={
                              pending || draft.revision !== data.revision
                            }
                            aria-label={`Include ${k.name}`}
                            checked={draft.ids.includes(k.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                ids: e.target.checked
                                  ? [...draft.ids, k.id]
                                  : draft.ids.filter((id) => id !== k.id),
                              })
                            }
                          />
                        </td>
                        <td>
                          <Identity name={k.name} />
                        </td>
                        <td>
                          {data.agents.find((a) => a.id === k.agent_id)?.name ??
                            "Unsigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sheet-toolbar sheet-form-footer">
                <p className="sheet-muted">
                  {draft.ids.length} selected. Unchecked keepers currently with{" "}
                  {agent.name} will become unsigned.
                </p>
                <div className="sheet-actions">
                  <button
                    type="button"
                    className="sheet-button"
                    disabled={pending}
                    onClick={() => selectAgent("")}
                  >
                    Cancel
                  </button>
                  <button
                    className="sheet-button sheet-primary"
                    disabled={pending || draft.revision !== data.revision}
                  >
                    {pending ? "Saving…" : "Save roster"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}

function RemoveNotice({
  name,
  pending,
  cancel,
  remove,
}: {
  name: string;
  pending: boolean;
  cancel: () => void;
  remove: () => Promise<unknown>;
}) {
  return (
    <div className="sheet-notice" role="alert">
      <div>
        Remove <strong>{name}</strong>?{" "}
        <span className="sheet-muted">
          Only unused entries can be removed. Existing history is preserved.
        </span>
      </div>
      <div className="sheet-actions">
        <button className="sheet-button" disabled={pending} onClick={cancel}>
          Cancel
        </button>
        <button
          className="sheet-button sheet-danger"
          disabled={pending}
          onClick={() => {
            void remove().catch(() => {});
          }}
        >
          Remove entry
        </button>
      </div>
    </div>
  );
}
