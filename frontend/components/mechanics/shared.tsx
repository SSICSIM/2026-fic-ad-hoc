"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { Agent, Keeper } from "@/types/mechanics";

export function EmptySheet({
  children,
  setup = false,
}: {
  children: ReactNode;
  setup?: boolean;
}) {
  return (
    <div className="sheet-empty">
      <p>{children}</p>
      {setup && (
        <Link className="sheet-link" href="/control-panel">
          Open control panel <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
}) {
  return (
    <main className="mechanics-shell">
      <div className="sheet-empty" role={error ? "alert" : "status"}>
        {loading ? (
          "Loading the Union register…"
        ) : (
          <>
            <p>{error?.message || "Unable to load the register."}</p>
            <button className="sheet-button" onClick={retry}>
              <RefreshCw size={14} /> Try again
            </button>
            <Link href="/login" className="sheet-link">
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export function Identity({ name, detail }: { name: string; detail?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div className="sheet-identity">
      <span className="sheet-avatar" aria-hidden="true">
        {initials}
      </span>
      <div>
        <span className="sheet-name">{name}</span>
        {detail && <span className="sheet-detail">{detail}</span>}
      </div>
    </div>
  );
}

export function AgentOptions({ agents }: { agents: Agent[] }) {
  return (
    <>
      <option value="">Unsigned</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );
}

export function KeeperTable({
  keepers,
  agents,
  pending = false,
  onAssign,
}: {
  keepers: Keeper[];
  agents: Agent[];
  pending?: boolean;
  onAssign?: (keeper: Keeper, agentId: number | null) => void;
}) {
  return (
    <div className="sheet-scroll">
      <table className="sheet-table">
        <thead>
          <tr>
            <th className="sheet-rank">Rank</th>
            <th>Groundskeeper</th>
            <th>Representation</th>
          </tr>
        </thead>
        <tbody>
          {keepers.map((k) => (
            <tr
              key={k.id}
              className={k.agent_id === null ? "sheet-unsigned" : undefined}
            >
              <td className="sheet-rank">{k.rank}</td>
              <td>
                <Identity name={k.name} detail={k.description} />
              </td>
              <td>
                {onAssign ? (
                  <select
                    className="sheet-cell-select"
                    aria-label={`Agent for ${k.name}`}
                    disabled={pending}
                    value={k.agent_id ?? ""}
                    onChange={(e) =>
                      onAssign(
                        k,
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <AgentOptions agents={agents} />
                  </select>
                ) : (
                  <span className={k.agent_id === null ? "sheet-muted" : ""}>
                    {agents.find((a) => a.id === k.agent_id)?.name ??
                      "Unsigned"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaleDraft({
  stale,
  reload,
}: {
  stale: boolean;
  reload: () => void;
}) {
  if (!stale) return null;
  return (
    <div className="sheet-notice" role="status">
      <span>
        The register changed while you were editing. Reload this form to review
        the latest values.
      </span>
      <button type="button" className="sheet-button" onClick={reload}>
        Reload form
      </button>
    </div>
  );
}
