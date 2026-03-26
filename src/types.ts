export type AgentRole = "Manager" | "Researcher" | "Coder" | "Writer";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: AgentRole;
  status: "pending" | "in-progress" | "completed" | "failed";
  result?: string;
}

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  status: "idle" | "thinking" | "working";
}
