export interface Agent {
  id: number;
  name: string;
  delegate_name: string;
  rank: number;
}

export interface Keeper {
  id: number;
  name: string;
  description: string;
  rank: number;
  agent_id: number | null;
}

export interface Movement {
  id: number;
  keeper_id: number;
  keeper_name: string;
  from_agent_id: number | null;
  from_agent_name: string | null;
  to_agent_id: number | null;
  to_agent_name: string | null;
  created_at: string;
}

export interface MechanicsSnapshot {
  revision: number;
  agents: Agent[];
  keepers: Keeper[];
  movements: Movement[];
}

export type MechanicsAction =
  | { type: "save_agent"; id?: number; name: string; delegate_name: string }
  | {
      type: "save_keeper";
      id?: number;
      name: string;
      description: string;
      agent_id: number | null;
    }
  | { type: "set_representation"; keeper_id: number; agent_id: number | null }
  | { type: "set_roster"; agent_id: number; keeper_ids: number[] }
  | { type: "reorder_keepers" | "reorder_agents"; ids: number[] }
  | { type: "remove_keeper" | "remove_agent"; id: number };

export type MechanicsCommand = MechanicsAction & { revision: number };
