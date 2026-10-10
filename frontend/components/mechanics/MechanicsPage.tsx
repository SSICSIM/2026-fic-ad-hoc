"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings2,
} from "lucide-react";
import { useMechanics } from "@/hooks/useMechanics";
import type { MechanicsAction, MechanicsSnapshot } from "@/types/mechanics";
import { EmptySheet, Identity, KeeperTable, QueryState } from "./shared";
import { RankingEditor } from "./RankingEditor";

const tabs = [
  { id: "keepers", label: "Groundskeepers" },
  { id: "rosters", label: "Agent rosters" },
  { id: "movements", label: "Movements" },
  { id: "agents", label: "Agent rankings" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export function MechanicsPage() {
  const { data, error, isPending, refetch, mutation, isFetching } =
    useMechanics();
  const [tab, setTab] = useState<Tab>("keepers");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [ranking, setRanking] = useState<"keepers" | "agents" | null>(null);
  if (!data)
    return (
      <QueryState
        loading={isPending}
        error={error}
        retry={() => void refetch()}
      />
    );
  const act = (action: MechanicsAction, revision = data.revision) =>
    mutation.mutateAsync({ ...action, revision });
  const keepers = data.keepers.filter(
    (k) =>
      (filter === "all" ||
        (filter === "signed" ? k.agent_id !== null : k.agent_id === null)) &&
      `${k.name} ${k.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="mechanics-shell">
      <div className="sheet-page-heading">
        <div>
          <p className="sheet-eyebrow">THE FEARMONGER SUMMIT</p>
          <h1>Union register</h1>
          <p className="sheet-muted">
            Groundskeepers, representation, and the order of things.
          </p>
        </div>
        <Link className="sheet-button" href="/control-panel">
          <Settings2 size={15} /> Control panel
        </Link>
      </div>
      <div className="sheet-workbook">
        <nav className="sheet-tabs" aria-label="Register worksheets">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setRanking(null);
                mutation.reset();
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sheet-content">
          {(error || mutation.error) && (
            <div className="sheet-notice sheet-error" role="alert">
              {mutation.error?.message || error?.message}
              <button
                className="sheet-button"
                onClick={() => {
                  mutation.reset();
                  void refetch();
                }}
              >
                Refresh
              </button>
            </div>
          )}
          {ranking ? (
            <RankingEditor
              key={ranking}
              kind={ranking}
              entries={ranking === "keepers" ? data.keepers : data.agents}
              revision={data.revision}
              pending={mutation.isPending}
              onCancel={() => setRanking(null)}
              onSave={(ids, revision) =>
                act(
                  {
                    type:
                      ranking === "keepers"
                        ? "reorder_keepers"
                        : "reorder_agents",
                    ids,
                  },
                  revision,
                )
              }
            />
          ) : (
            <>
              {tab === "keepers" && (
                <>
                  <div className="sheet-toolbar">
                    <div
                      className="sheet-filter-group"
                      aria-label="Representation filter"
                    >
                      {["all", "signed", "unsigned"].map((f) => (
                        <button
                          key={f}
                          className="sheet-button"
                          aria-pressed={filter === f}
                          onClick={() => setFilter(f)}
                        >
                          {f[0].toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="sheet-actions">
                      <label className="sheet-search">
                        <Search size={15} aria-hidden="true" />
                        <input
                          aria-label="Search Groundskeepers"
                          placeholder="Find a Groundskeeper…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <button
                        className="sheet-button"
                        disabled={!data.keepers.length || mutation.isPending}
                        onClick={() => setRanking("keepers")}
                      >
                        <ArrowDownUp size={14} /> Edit ranking
                      </button>
                    </div>
                  </div>
                  {keepers.length ? (
                    <KeeperTable
                      keepers={keepers}
                      agents={data.agents}
                      pending={mutation.isPending}
                      onAssign={(keeper, agent_id) => {
                        void act({
                          type: "set_representation",
                          keeper_id: keeper.id,
                          agent_id,
                        }).catch(() => {});
                      }}
                    />
                  ) : (
                    <EmptySheet setup={!data.keepers.length}>
                      {data.keepers.length
                        ? "No Groundskeepers match this view."
                        : "The register is ready. Add your agents and Groundskeepers to begin."}
                    </EmptySheet>
                  )}
                </>
              )}
              {tab === "rosters" && <RosterView data={data} />}
              {tab === "movements" && <MovementView data={data} />}
              {tab === "agents" && (
                <>
                  <div className="sheet-toolbar">
                    <div>
                      <h2>Agent rankings</h2>
                      <p className="sheet-muted">
                        Staff-assigned order, independent of roster size.
                      </p>
                    </div>
                    <button
                      className="sheet-button"
                      disabled={!data.agents.length || mutation.isPending}
                      onClick={() => setRanking("agents")}
                    >
                      <ArrowDownUp size={14} /> Edit ranking
                    </button>
                  </div>
                  {data.agents.length ? (
                    <div className="sheet-scroll">
                      <table className="sheet-table">
                        <thead>
                          <tr>
                            <th className="sheet-rank">Rank</th>
                            <th>Agent</th>
                            <th>Delegate</th>
                            <th className="sheet-end">Keepers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.agents.map((a) => (
                            <tr key={a.id}>
                              <td className="sheet-rank">{a.rank}</td>
                              <td>
                                <Identity name={a.name} />
                              </td>
                              <td>
                                {a.delegate_name || (
                                  <span className="sheet-muted">—</span>
                                )}
                              </td>
                              <td className="sheet-end sheet-number">
                                {
                                  data.keepers.filter(
                                    (k) => k.agent_id === a.id,
                                  ).length
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptySheet setup>No agents yet.</EmptySheet>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <footer className="sheet-status">
          <span>
            {data.keepers.length} Groundskeepers{" "}
            <span aria-hidden="true">·</span>{" "}
            {data.keepers.filter((k) => k.agent_id !== null).length} signed{" "}
            <span aria-hidden="true">·</span> {data.agents.length} agents
          </span>
          <span role="status">
            {mutation.isPending
              ? "Saving…"
              : error
                ? "Connection interrupted"
                : isFetching
                  ? "Refreshing…"
                  : "Up to date"}
          </span>
        </footer>
      </div>
    </main>
  );
}

function RosterView({ data }: { data: MechanicsSnapshot }) {
  const [mode, setMode] = useState("all");
  const [agentId, setAgentId] = useState<number | null>(null);
  const index = Math.max(
    0,
    data.agents.findIndex((a) => a.id === agentId),
  );
  const agent = data.agents[index];
  if (!agent)
    return <EmptySheet setup>Add agents to start building rosters.</EmptySheet>;
  const shown = mode === "all" ? data.agents : [agent];
  return (
    <>
      <div className="sheet-toolbar">
        <div className="sheet-filter-group">
          <button
            className="sheet-button"
            aria-pressed={mode === "all"}
            onClick={() => setMode("all")}
          >
            All agents
          </button>
          <button
            className="sheet-button"
            aria-pressed={mode === "one"}
            onClick={() => setMode("one")}
          >
            One agent
          </button>
        </div>
        {mode === "one" && (
          <div className="sheet-actions">
            <button
              className="sheet-icon-button"
              aria-label="Previous agent"
              disabled={index === 0}
              onClick={() => setAgentId(data.agents[index - 1].id)}
            >
              <ChevronLeft size={17} />
            </button>
            <select
              className="sheet-select"
              aria-label="Choose agent"
              value={agent.id}
              onChange={(e) => setAgentId(Number(e.target.value))}
            >
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className="sheet-icon-button"
              aria-label="Next agent"
              disabled={index === data.agents.length - 1}
              onClick={() => setAgentId(data.agents[index + 1].id)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
      <div className="sheet-rosters">
        {shown.map((a) => {
          const roster = data.keepers.filter((k) => k.agent_id === a.id);
          return (
            <section className="sheet-roster" key={a.id}>
              <div className="sheet-roster-heading">
                <div>
                  <span className="sheet-muted sheet-number">
                    {a.rank.toString().padStart(2, "0")}
                  </span>{" "}
                  <strong>{a.name}</strong>
                  {a.delegate_name && (
                    <span className="sheet-muted"> · {a.delegate_name}</span>
                  )}
                </div>
                <span className="sheet-muted">
                  {roster.length} {roster.length === 1 ? "keeper" : "keepers"}
                </span>
              </div>
              {roster.length ? (
                <KeeperTable keepers={roster} agents={data.agents} />
              ) : (
                <div className="sheet-roster-empty">
                  No signed Groundskeepers.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function MovementView({ data }: { data: MechanicsSnapshot }) {
  const [agent, setAgent] = useState("");
  const [keeper, setKeeper] = useState("");
  const movements = data.movements.filter(
    (m) =>
      (!agent ||
        m.from_agent_id === Number(agent) ||
        m.to_agent_id === Number(agent)) &&
      (!keeper || m.keeper_id === Number(keeper)),
  );
  return (
    <>
      <div className="sheet-toolbar">
        <div>
          <h2>Movement log</h2>
          <p className="sheet-muted">
            Every signing, release, and change of representation.
          </p>
        </div>
        <div className="sheet-actions">
          <select
            className="sheet-select"
            aria-label="Filter movements by agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="">All agents</option>
            {data.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            className="sheet-select"
            aria-label="Filter movements by Groundskeeper"
            value={keeper}
            onChange={(e) => setKeeper(e.target.value)}
          >
            <option value="">All Groundskeepers</option>
            {data.keepers.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {movements.length ? (
        <div className="sheet-scroll">
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Recorded</th>
                <th>Groundskeeper</th>
                <th>Action</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="sheet-time">
                    <time dateTime={m.created_at}>
                      {new Date(m.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>
                  <td className="sheet-name">{m.keeper_name}</td>
                  <td>
                    <span
                      className={`sheet-event ${m.to_agent_id === null ? "sheet-event-drop" : ""}`}
                    >
                      {m.from_agent_id === null
                        ? "Signed"
                        : m.to_agent_id === null
                          ? "Dropped"
                          : "Transferred"}
                    </span>
                  </td>
                  <td>{m.from_agent_name ?? "Unsigned"}</td>
                  <td>{m.to_agent_name ?? "Unsigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptySheet>
          {data.movements.length
            ? "No movements match these filters."
            : "No movements yet. Assigning a Groundskeeper records the change here automatically."}
        </EmptySheet>
      )}
    </>
  );
}
