export interface TeamAgent {
  id: string;
  handle: string;
  name: string;
  platform: string;
  role: string;
  active: boolean;
  external_active: boolean;
  retired_at: string | null;
}
export interface TeamThread {
  id: string;
  title: string;
  area_id: string | null;
  participants: string[];
  visibility: string;
}
export interface TeamWork {
  entry_id: string;
  objective: string;
  assigned_agent_id: string;
  bridge_agent_id: string | null;
  status: string;
  current_step: string;
  expected_output: string;
  acceptance_criteria: string;
  last_error: string | null;
  due_at: string | null;
}
export interface TeamConnection {
  provider: string;
  status: string;
  connection_mode: string;
  capabilities: string[];
  last_success_at: string | null;
  activation_steps: string;
}
export interface TeamSchedule {
  id: string;
  title: string;
  cadence: string;
  origin: string;
  active: boolean;
  verified_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  consumption: number;
  activation_steps: string;
}
export interface TeamApproval {
  id: string;
  entry_id: string;
  status: string;
  target: string;
  payload_hash: string;
  payload_ref: {
    action: string;
    account: string;
    target: string;
    body: string;
    attachments: unknown[];
  };
  expires_at: string;
}
export interface TeamMessage {
  id: string;
  body: string;
  source: string;
  agent_id: string | null;
  actor_id: string;
  created_at: string;
  origin_chat_title: string | null;
  entry_id: string | null;
  refs: { artifact_id: string }[];
  reply_to: string | null;
}
export interface TeamSnapshot {
  agents: TeamAgent[];
  threads: TeamThread[];
  works: TeamWork[];
  connections: TeamConnection[];
  schedules: TeamSchedule[];
  approvals: TeamApproval[];
  paused: boolean;
  artifacts: {
    id: string;
    name: string;
    entry_id: string | null;
    mime: string;
  }[];
  clients: {
    id: string;
    name: string;
    token_prefix: string;
    expires_at: string;
    revoked_at: string | null;
  }[];
  demo: boolean;
  error?: string;
}
