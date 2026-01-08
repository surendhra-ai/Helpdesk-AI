// Data model based on the user's Frappe Helpdesk export structure
export interface RawTicket {
  Sr: string;
  Subject: string;
  Status: string;
  ResolutionBy: string; // Date string
  Assign: string; // JSON array string e.g. "['email@example.com']"
  Customer: string;
  Priority: string;
  TicketType: string;
  Owner: string;
  Rating: string; // Numeric string
  Creation: string; // Date string
}

export interface Ticket {
  id: string;
  subject: string;
  status: 'Open' | 'Closed' | 'Replied' | 'Overdue' | string;
  assignees: string[];
  customer: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  ticketType: string;
  owner: string;
  rating: number;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionTimeHours: number; // Calculated
}

export interface AgentMetrics {
  email: string;
  totalTickets: number;
  avgRating: number;
  avgResolutionHours: number;
  activeTickets: number;
}

export interface TeamInsight {
  teamName: string;
  insight: string;
  recommendation: string;
}

export interface AIRecommendation {
  summary: string;
  periodContext: string; // e.g. "Analysis for Last 30 Days"
  resourceAllocation: string;
  ticketReductionStrategy: string;
  teamAnalysis: TeamInsight[];
  agentPerformance: {
    topPerformer: string;
    needsAttention: string;
    suggestion: string;
  };
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  AGENTS = 'AGENTS',
  AI_INSIGHTS = 'AI_INSIGHTS',
  AI_ASSISTANT = 'AI_ASSISTANT',
  DATA_UPLOAD = 'DATA_UPLOAD',
  SETTINGS = 'SETTINGS'
}

export type TimeRange = 'all' | 'last-7-days' | 'last-30-days' | 'this-month' | 'last-month';

export type LLMProvider = 'gemini' | 'openai' | 'custom';

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string; // For OpenAI/Custom. Gemini uses env.
  modelName: string;
  baseURL?: string; // For Custom/Local LLMs
}
