import { api } from '@/lib/api';
import type {
  AuthResponse,
  User,
  Lead,
  Project,
  Call,
  Appointment,
  AiAgentSettings,
  AgentPlaybookSummary,
  DashboardStats,
  FullAnalytics,
  LeadQueryParams,
  LeadNote,
} from '@/types';

export const authService = {
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/auth/forgot-password', data),
  getProfile: (token: string) => api.get<User>('/auth/me', token),
};

export const leadsService = {
  getAll: (token: string, params?: LeadQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.minBudget) searchParams.set('minBudget', String(params.minBudget));
    if (params?.maxBudget) searchParams.set('maxBudget', String(params.maxBudget));
    const query = searchParams.toString();
    return api.get<Lead[]>(`/leads${query ? `?${query}` : ''}`, token);
  },
  getById: (token: string, id: string) => api.get<Lead>(`/leads/${id}`, token),
  create: (token: string, data: Partial<Lead>) => api.post<Lead>('/leads', data, token),
  createBulk: (token: string, leads: Partial<Lead>[]) =>
    api.post<Lead[]>('/leads/bulk', { leads }, token),
  update: (token: string, id: string, data: Partial<Lead>) =>
    api.patch<Lead>(`/leads/${id}`, data, token),
  delete: (token: string, id: string) => api.delete(`/leads/${id}`, token),
  addNote: (token: string, id: string, content: string) =>
    api.post<LeadNote>(`/leads/${id}/notes`, { content }, token),
};

export const projectsService = {
  getAll: (token: string) => api.get<Project[]>('/projects', token),
  getById: (token: string, id: string) => api.get<Project>(`/projects/${id}`, token),
  create: (token: string, data: Partial<Project>) =>
    api.post<Project>('/projects', data, token),
  update: (token: string, id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data, token),
  delete: (token: string, id: string) => api.delete(`/projects/${id}`, token),
};

export const aiService = {
  getSettings: (token: string) => api.get<AiAgentSettings>('/ai/settings', token),
  getPlaybook: (token: string) =>
    api.get<AgentPlaybookSummary>('/ai/playbook', token),
  updateSettings: (token: string, data: Partial<AiAgentSettings>) =>
    api.patch<AiAgentSettings>('/ai/settings', data, token),
  uploadKnowledgeBase: (token: string, files: string[]) =>
    api.post<AiAgentSettings>('/ai/knowledge-base', { files }, token),
  previewVoice: (
    token: string,
    data?: { text?: string; speaker?: string; language?: string },
  ) =>
    api.post<{
      speaker: string;
      language: string;
      mimeType: string;
      audioBase64: string;
      fileName: string;
    }>('/ai/preview-voice', data || {}, token),
};

export const callsService = {
  getAll: (token: string) => api.get<Call[]>('/calls', token),
  getById: (token: string, id: string) => api.get<Call>(`/calls/${id}`, token),
  startOutbound: (
    token: string,
    leadId: string,
    options?: {
      browserDemo?: boolean;
      provider?: 'twilio' | 'exotel' | 'mcube' | 'browser-demo';
    },
  ) =>
    api.post<
      Call & {
        demoMode?: boolean;
        audioUrl?: string;
        audioBase64?: string;
        mimeType?: string;
        greetingText?: string;
        agentName?: string;
        agentVoice?: string;
        message?: string;
        status?: string;
        providerCallId?: string | null;
      }
    >(
      '/calls/outbound',
      {
        leadId,
        browserDemo: options?.browserDemo ?? true,
        provider: options?.provider,
      },
      token,
    ),
  twilioStatus: (token: string) =>
    api.get<{
      configured: boolean;
      fromNumber: string | null;
      publicBaseUrl: string;
      webhookVoice: string;
      webhookStatus: string;
      mediaWs: string;
      webhookReady: boolean;
      needsTunnel: boolean;
      message: string;
    }>('/calls/twilio-status', token),
  exotelStatus: (token: string) =>
    api.get<{
      configured: boolean;
      fromNumber: string | null;
      appId: string | null;
      publicBaseUrl: string;
      webhookStatus: string;
      webhookGreeting: string;
      webhookVoicebot: string;
      voicebotWs: string;
      webhookReady: boolean;
      needsTunnel: boolean;
      message: string;
    }>('/calls/exotel-status', token),
  mcubeStatus: (token: string) =>
    api.get<{
      configured: boolean;
      publicBaseUrl: string;
      websocketUrlTemplate: string;
      alternativeWsUrl: string;
      webhookReady: boolean;
      needsTunnel: boolean;
      message: string;
    }>('/calls/mcube-status', token),
  demoTurn: (
    token: string,
    data: {
      callId: string;
      message?: string;
      audioBase64?: string;
      fileName?: string;
    },
  ) =>
    api.post<{
      callId: string;
      userMessage: string;
      replyText: string;
      outcome: string;
      audioBase64: string;
      mimeType: string;
      transcript: string;
      interestScore?: number;
      duration?: number;
      qualification?: Record<string, unknown>;
    }>('/calls/demo-turn', data, token),
  /** Prefer this for faster voice — see streamDemoTurn in lib/stream-demo-turn */
  endDemo: (token: string, callId: string) =>
    api.post<Call>(`/calls/${callId}/end`, {}, token),
};

export const appointmentsService = {
  getAll: (token: string, status?: string) =>
    api.get<Appointment[]>(
      `/appointments${status ? `?status=${status}` : ''}`,
      token,
    ),
  create: (token: string, data: Partial<Appointment>) =>
    api.post<Appointment>('/appointments', data, token),
  update: (token: string, id: string, data: Partial<Appointment>) =>
    api.patch<Appointment>(`/appointments/${id}`, data, token),
  delete: (token: string, id: string) => api.delete(`/appointments/${id}`, token),
};

export const analyticsService = {
  getDashboard: (token: string) =>
    api.get<DashboardStats>('/analytics/dashboard', token),
  getFull: (token: string) => api.get<FullAnalytics>('/analytics', token),
};

export const knowledgeService = {
  listByProject: (token: string, projectId: string) =>
    api.get<any[]>(`/knowledge/project/${projectId}`, token),
  get: (token: string, id: string) => api.get<any>(`/knowledge/${id}`, token),
  addWebsite: (token: string, data: { projectId: string; url: string; title?: string }) =>
    api.post('/knowledge/website', data, token),
  addText: (
    token: string,
    data: { projectId: string; title: string; text: string; sourceType?: string },
  ) => api.post('/knowledge/text', data, token),
  upload: (token: string, formData: FormData) =>
    api.upload('/knowledge/upload', formData, token),
  reprocess: (token: string, id: string) =>
    api.post(`/knowledge/${id}/reprocess`, {}, token),
  remove: (token: string, id: string) => api.delete(`/knowledge/${id}`, token),
};

export const campaignsService = {
  list: (token: string) => api.get<any[]>('/campaigns', token),
  get: (token: string, id: string) => api.get<any>(`/campaigns/${id}`, token),
  create: (token: string, data: Record<string, unknown>) =>
    api.post('/campaigns', data, token),
  setStatus: (token: string, id: string, status: string) =>
    api.patch(`/campaigns/${id}/status`, { status }, token),
  processDue: (token: string) => api.post('/campaigns/process-due', {}, token),
};

export const feedbackService = {
  list: (token: string, status?: string) =>
    api.get<any[]>(`/feedback${status ? `?status=${status}` : ''}`, token),
  analytics: (token: string) => api.get<any>('/feedback/analytics', token),
  create: (token: string, data: Record<string, unknown>) =>
    api.post('/feedback', data, token),
  moderate: (token: string, id: string, status: string) =>
    api.patch(`/feedback/${id}/moderate`, { status }, token),
};
