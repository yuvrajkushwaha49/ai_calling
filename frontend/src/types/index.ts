export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'NEGOTIATION'
  | 'CONVERTED'
  | 'LOST';

export type LeadSource =
  | 'WEBSITE'
  | 'REFERRAL'
  | 'SOCIAL_MEDIA'
  | 'COLD_CALL'
  | 'WALK_IN'
  | 'OTHER';

export type PropertyType =
  | 'APARTMENT'
  | 'VILLA'
  | 'PLOT'
  | 'COMMERCIAL'
  | 'PENTHOUSE';

export type CallOutcome =
  | 'CONNECTED'
  | 'NO_ANSWER'
  | 'VOICEMAIL'
  | 'CALLBACK_REQUESTED'
  | 'QUALIFIED'
  | 'NOT_INTERESTED';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  companyName?: string | null;
  location: string;
  builder: string;
  propertyType: PropertyType;
  startingPrice: number | string;
  endingPrice: number | string;
  possessionDate?: string | null;
  reraNumber?: string | null;
  amenities: string[];
  description?: string | null;
  websiteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { leads: number; appointments: number };
  leads?: Lead[];
  appointments?: Appointment[];
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  source: LeadSource;
  budget?: number | string | null;
  propertyType?: PropertyType | null;
  status: LeadStatus;
  notes?: string | null;
  projectId?: string | null;
  aiSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, 'id' | 'name' | 'location'> | null;
  calls?: Call[];
  appointments?: Appointment[];
  leadNotes?: LeadNote[];
  activities?: Activity[];
  _count?: { calls: number; appointments: number };
}

export interface LeadNote {
  id: string;
  leadId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface Activity {
  id: string;
  leadId: string;
  userId?: string | null;
  type: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  lead?: Pick<Lead, 'id' | 'name'>;
  user?: Pick<User, 'id' | 'name'> | null;
}

export interface Call {
  id: string;
  leadId: string;
  duration: number;
  interestScore?: number | null;
  transcript?: string | null;
  summary?: string | null;
  recordingUrl?: string | null;
  outcome: CallOutcome;
  status?: string;
  providerCallId?: string | null;
  greetingText?: string | null;
  qualificationJson?: Record<string, unknown> | null;
  createdAt: string;
  lead?: Pick<Lead, 'id' | 'name' | 'phone' | 'email'> & {
    project?: Pick<Project, 'id' | 'name'> | null;
  };
}

export interface Appointment {
  id: string;
  leadId: string;
  projectId?: string | null;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: Pick<Lead, 'id' | 'name' | 'phone' | 'email'>;
  project?: Pick<Project, 'id' | 'name' | 'location'> | null;
}

export interface AiAgentSettings {
  id: string;
  agentName: string;
  agentVoice: string;
  language: string;
  tone: string;
  llmModel?: string;
  llmConfigured?: boolean;
  llmProvider?: string;
  systemPrompt: string;
  workingHours: {
    start: string;
    end: string;
    days: string[];
  };
  knowledgeBase: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPlaybookSummary {
  preferredOpener: string | null;
  lastOpener: string | null;
  openerStyles: {
    id: string;
    uses: number;
    wins: number;
    winRate: number;
  }[];
  tips: {
    note: string;
    rating?: string;
    source: string;
    at: string;
  }[];
  autoLessons: {
    lesson: string;
    outcome: string;
    at: string;
    callId?: string;
  }[];
  history: {
    at: string;
    kind: 'auto_lesson' | 'feedback_tip' | 'opener_preferred';
    summary: string;
    detail?: string;
    callId?: string;
  }[];
  totals: {
    tips: number;
    autoLessons: number;
    history: number;
  };
}

export interface DashboardStats {
  totalLeads: number;
  callsToday: number;
  qualifiedLeads: number;
  appointments: number;
  revenue: number;
  recentActivities: Activity[];
  leadSources: { source: string; count: number }[];
  callsAnalytics: { date: string; count: number }[];
}

export interface FullAnalytics {
  dailyCalls: { date: string; count: number }[];
  monthlyCalls: { month: string; count: number }[];
  qualifiedLeads: number;
  conversionRate: number;
  projectPerformance: {
    id: string;
    name: string;
    leads: number;
    appointments: number;
  }[];
  agentPerformance: {
    id: string;
    name: string;
    activities: number;
  }[];
}

export interface LeadQueryParams {
  search?: string;
  status?: LeadStatus;
  projectId?: string;
  minBudget?: number;
  maxBudget?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
