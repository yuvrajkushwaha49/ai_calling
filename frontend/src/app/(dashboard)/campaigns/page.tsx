'use client';

import { useState } from 'react';
import { Loader2, PhoneCall, Play, Pause, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useCampaigns, useProjects, useLeads } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { campaignsService } from '@/services';
import { useQueryClient } from '@tanstack/react-query';

export default function CampaignsPage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const { data: campaigns, isLoading, isError, error } = useCampaigns();
  const { data: projects } = useProjects();
  const { data: leads } = useLeads();
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const projectLeads = (leads || []).filter(
    (l) => !projectId || l.projectId === projectId,
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });

  const createCampaign = async () => {
    if (!token || !name) return;
    setBusy(true);
    setMsg('');
    try {
      await campaignsService.create(token, {
        name,
        projectId: projectId || undefined,
        leadIds: selectedLeadIds.length ? selectedLeadIds : undefined,
        scheduledAt: scheduledAt || undefined,
      });
      setName('');
      setSelectedLeadIds([]);
      await refresh();
      setMsg('Campaign created. Start it when ready.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await campaignsService.setStatus(token, id, status);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout title="Automatic Call Campaigns">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-blue-600" />
              Create campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Queue AI calls for leads linked to a project. Respects Do Not Call, consent,
              working hours, and retries.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select leads (optional — leave empty to include all eligible project leads)</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {projectLeads.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(l.id)}
                      onChange={(e) => {
                        setSelectedLeadIds((prev) =>
                          e.target.checked
                            ? [...prev, l.id]
                            : prev.filter((id) => id !== l.id),
                        );
                      }}
                    />
                    {l.name} · {l.phone} · {l.status}
                    {!l.projectId && (
                      <span className="text-xs text-destructive">(no project)</span>
                    )}
                  </label>
                ))}
                {!projectLeads.length && (
                  <p className="text-xs text-muted-foreground">No leads for this filter.</p>
                )}
              </div>
            </div>

            <Button disabled={busy || !name} onClick={() => void createCampaign()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create campaign
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campaign queue</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !token}
              onClick={() =>
                token &&
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await campaignsService.processDue(token);
                    setMsg(`Processed: ${JSON.stringify(res)}`);
                    await refresh();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed');
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Process due now
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(campaigns || []).map((c: any) => (
              <div key={c.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.status} · {c.project?.name || 'Multi-project'} · queue{' '}
                      {c._count?.queueItems ?? 0} · calls {c._count?.calls ?? 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status !== 'RUNNING' && c.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        onClick={() => void setStatus(c.id, 'RUNNING')}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Start
                      </Button>
                    )}
                    {c.status === 'RUNNING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void setStatus(c.id, 'PAUSED')}
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </Button>
                    )}
                    {c.status === 'PAUSED' && (
                      <Button
                        size="sm"
                        onClick={() => void setStatus(c.id, 'RUNNING')}
                      >
                        Resume
                      </Button>
                    )}
                    {c.status !== 'CANCELLED' && c.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void setStatus(c.id, 'CANCELLED')}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!(campaigns || []).length && (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            )}
          </CardContent>
        </Card>

        {msg && <p className="text-center text-sm text-muted-foreground">{msg}</p>}
      </div>
    </DashboardLayout>
  );
}
