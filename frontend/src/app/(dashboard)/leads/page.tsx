'use client';

import { useState } from 'react';
import { Search, Filter, UserPlus, Upload } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LeadDetailDrawer } from '@/components/leads/lead-detail-drawer';
import { AddLeadModal } from '@/components/leads/add-lead-modal';
import { ImportLeadsModal } from '@/components/leads/import-leads-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/common/status-badge';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useLeads, useProjects } from '@/hooks/use-api';
import { useUiStore } from '@/stores/ui-store';
import { formatCurrency } from '@/lib/utils';
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/lib/constants';
import type { LeadStatus } from '@/types';

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('all');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const { openLeadDrawer } = useUiStore();
  const { data: projects } = useProjects();
  const { data: leads, isLoading, isError, error } = useLeads({
    search: search || undefined,
    status: status !== 'all' ? (status as LeadStatus) : undefined,
    projectId: projectId !== 'all' ? projectId : undefined,
    minBudget: minBudget ? Number(minBudget) : undefined,
    maxBudget: maxBudget ? Number(maxBudget) : undefined,
  });

  return (
    <DashboardLayout title="Leads Management">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, or phone..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Min Budget"
            className="w-[140px]"
            value={minBudget}
            onChange={(e) => setMinBudget(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max Budget"
            className="w-[140px]"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
          />

          {(status !== 'all' || projectId !== 'all' || minBudget || maxBudget) && (
            <Button
              variant="outline"
              onClick={() => {
                setStatus('all');
                setProjectId('all');
                setMinBudget('');
                setMaxBudget('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {isLoading && <PageLoader />}
        {isError && <ErrorMessage message={(error as Error).message} />}

        {leads && (
          <div className="panel-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="panel-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40">
                    <th className="px-5 py-3 text-left lg:px-6">Name</th>
                    <th className="px-5 py-3 text-left lg:px-6">Phone</th>
                    <th className="px-5 py-3 text-left lg:px-6">Source</th>
                    <th className="px-5 py-3 text-left lg:px-6">
                      Budget
                      <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                        (from call)
                      </span>
                    </th>
                    <th className="px-5 py-3 text-left lg:px-6">Type</th>
                    <th className="px-5 py-3 text-left lg:px-6">Project</th>
                    <th className="px-5 py-3 text-left lg:px-6">Status</th>
                    <th className="px-5 py-3 text-left lg:px-6">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                      onClick={() => openLeadDrawer(lead)}
                    >
                      <td className="px-5 py-3.5 font-medium lg:px-6">{lead.name}</td>
                      <td className="px-5 py-3.5 lg:px-6">{lead.phone}</td>
                      <td className="px-5 py-3.5 lg:px-6">{LEAD_SOURCE_LABELS[lead.source]}</td>
                      <td className="px-5 py-3.5 tabular-nums lg:px-6">
                        {lead.budget ? formatCurrency(Number(lead.budget)) : '—'}
                      </td>
                      <td className="px-5 py-3.5 lg:px-6">
                        {lead.propertyType ? PROPERTY_TYPE_LABELS[lead.propertyType] : '—'}
                      </td>
                      <td className="px-5 py-3.5 lg:px-6">{lead.project?.name || '—'}</td>
                      <td className="px-5 py-3.5 lg:px-6">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3.5 lg:px-6">{lead._count?.calls ?? 0}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                        No leads found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <LeadDetailDrawer />
      <AddLeadModal open={addModalOpen} onOpenChange={setAddModalOpen} />
      <ImportLeadsModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </DashboardLayout>
  );
}
