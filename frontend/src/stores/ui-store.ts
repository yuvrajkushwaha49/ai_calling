import { create } from 'zustand';
import type { Lead } from '@/types';

interface UiState {
  sidebarOpen: boolean;
  selectedLead: Lead | null;
  leadDrawerOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openLeadDrawer: (lead: Lead) => void;
  closeLeadDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  selectedLead: null,
  leadDrawerOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openLeadDrawer: (lead) => set({ selectedLead: lead, leadDrawerOpen: true }),
  closeLeadDrawer: () => set({ selectedLead: null, leadDrawerOpen: false }),
}));
