import { useAuthStore } from '@/stores/auth-store';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  authService,
  leadsService,
  projectsService,
  callsService,
  appointmentsService,
  aiService,
  analyticsService,
  knowledgeService,
  campaignsService,
  feedbackService,
} from '@/services';
import type { LeadQueryParams } from '@/types';

function useToken() {
  return useAuthStore((s) => s.token);
}

export function useDashboardStats() {
  const token = useToken();
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsService.getDashboard(token!),
    enabled: !!token,
  });
}

export function useAnalytics() {
  const token = useToken();
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.getFull(token!),
    enabled: !!token,
  });
}

export function useLeads(params?: LeadQueryParams) {
  const token = useToken();
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsService.getAll(token!, params),
    enabled: !!token,
  });
}

export function useLead(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsService.getById(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateLead() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof leadsService.create>[1]) =>
      leadsService.create(token!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useCreateBulkLeads() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leads: Parameters<typeof leadsService.create>[1][]) =>
      leadsService.createBulk(token!, leads),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof leadsService.update>[2] }) =>
      leadsService.update(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAddLeadNote() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      leadsService.addNote(token!, id, content),
    onSuccess: (_, { id }) => queryClient.invalidateQueries({ queryKey: ['leads', id] }),
  });
}

export function useProjects() {
  const token = useToken();
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(token!),
    enabled: !!token,
  });
}

export function useProject(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsService.getById(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateProject() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof projectsService.create>[1]) =>
      projectsService.create(token!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof projectsService.update>[2] }) =>
      projectsService.update(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.delete(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useCalls() {
  const token = useToken();
  return useQuery({
    queryKey: ['calls'],
    queryFn: () => callsService.getAll(token!),
    enabled: !!token,
  });
}

export function useAppointments(status?: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['appointments', status],
    queryFn: () => appointmentsService.getAll(token!, status),
    enabled: !!token,
  });
}

export function useUpdateAppointment() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof appointmentsService.update>[2] }) =>
      appointmentsService.update(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

export function useAiSettings() {
  const token = useToken();
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => aiService.getSettings(token!),
    enabled: !!token,
  });
}

export function usePreviewVoice() {
  const token = useToken();
  return useMutation({
    mutationFn: (data?: { text?: string; speaker?: string; language?: string }) =>
      aiService.previewVoice(token!, data),
  });
}

export function useDemoTurn() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      callId: string;
      message?: string;
      audioBase64?: string;
      fileName?: string;
    }) => callsService.demoTurn(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useEndDemoCall() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callsService.endDemo(token!, callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTwilioStatus() {
  const token = useToken();
  return useQuery({
    queryKey: ['twilio-status'],
    queryFn: () => callsService.twilioStatus(token!),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useExotelStatus() {
  const token = useToken();
  return useQuery({
    queryKey: ['exotel-status'],
    queryFn: () => callsService.exotelStatus(token!),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useMcubeStatus() {
  const token = useToken();
  return useQuery({
    queryKey: ['mcube-status'],
    queryFn: () => callsService.mcubeStatus(token!),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useStartOutboundCall() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      browserDemo = true,
      provider,
    }: {
      leadId: string;
      browserDemo?: boolean;
      provider?: 'twilio' | 'exotel' | 'mcube' | 'browser-demo';
    }) =>
      callsService.startOutbound(token!, leadId, { browserDemo, provider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateAiSettings() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof aiService.updateSettings>[1]) =>
      aiService.updateSettings(token!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-settings'] }),
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authService.forgotPassword });
}

export function useProjectKnowledge(projectId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['knowledge', projectId],
    queryFn: () => knowledgeService.listByProject(token!, projectId),
    enabled: !!token && !!projectId,
  });
}

export function useCampaigns() {
  const token = useToken();
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsService.list(token!),
    enabled: !!token,
  });
}

export function useCampaign(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => campaignsService.get(token!, id),
    enabled: !!token && !!id,
  });
}

export function useFeedbackList(status?: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['feedback', status],
    queryFn: () => feedbackService.list(token!, status),
    enabled: !!token,
  });
}

export function useFeedbackAnalytics() {
  const token = useToken();
  return useQuery({
    queryKey: ['feedback-analytics'],
    queryFn: () => feedbackService.analytics(token!),
    enabled: !!token,
  });
}

export function useAgentPlaybook() {
  const token = useToken();
  return useQuery({
    queryKey: ['ai-playbook'],
    queryFn: () => aiService.getPlaybook(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}
