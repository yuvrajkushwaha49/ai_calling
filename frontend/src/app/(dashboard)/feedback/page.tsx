'use client';

import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import {
  useAgentPlaybook,
  useFeedbackAnalytics,
  useFeedbackList,
} from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { feedbackService } from '@/services';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

function formatWhen(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function kindLabel(kind: string) {
  if (kind === 'feedback_tip') return 'Human tip';
  if (kind === 'opener_preferred') return 'Opener learn';
  return 'Auto lesson';
}

function kindClass(kind: string) {
  if (kind === 'feedback_tip') return 'bg-sky-100 text-sky-800';
  if (kind === 'opener_preferred') return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-900';
}

export default function FeedbackPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: pending, isLoading, isError, error } = useFeedbackList('PENDING');
  const { data: analytics } = useFeedbackAnalytics();
  const { data: playbook, isLoading: playbookLoading } = useAgentPlaybook();
  const [busyId, setBusyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [form, setForm] = useState({
    callId: '',
    rating: 'POOR',
    category: 'reply',
    comment: '',
    correctedReply: '',
  });

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('callId');
      if (fromUrl) setForm((f) => ({ ...f, callId: fromUrl }));
    } catch {
      // ignore
    }
  }, []);

  const moderate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (!token) return;
    setBusyId(id);
    try {
      await feedbackService.moderate(token, id, status);
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
      await queryClient.invalidateQueries({ queryKey: ['feedback-analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-playbook'] });
    } finally {
      setBusyId('');
    }
  };

  const submitFeedback = async () => {
    if (!token || !form.callId.trim()) {
      setSubmitMsg('Call ID required — Calls page se copy karo.');
      return;
    }
    setSubmitting(true);
    setSubmitMsg('');
    try {
      await feedbackService.create(token, {
        callId: form.callId.trim(),
        rating: form.rating,
        category: form.category || undefined,
        comment: form.comment.trim() || undefined,
        correctedReply: form.correctedReply.trim() || undefined,
      });
      setSubmitMsg('Submitted — Admin approve karega neeche Pending list mein.');
      setForm((f) => ({ ...f, comment: '', correctedReply: '', callId: '' }));
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="AI Learning & Feedback">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Self-improve kya hai</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Har call ke baad agent short principles seekhta hai (auto lessons).
              Opening lines alag styles try karti hain — jo better engage kare, uski win-rate badhti hai.
            </p>
            <p>
              Neeche timeline mein dikhega <strong>kab</strong> improve hua aur{' '}
              <strong>kya</strong> seekha. Human feedback approve hone par tip bhi yahin aati hai.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto lessons</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {playbook?.totals?.autoLessons ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approved tips</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {playbook?.totals?.tips ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferred opener</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold capitalize">
              {(playbook?.preferredOpener || 'learning…').replace(/_/g, ' ')}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Improvement timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbookLoading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </p>
            )}
            {(playbook?.history || []).map((h, i) => (
              <div
                key={`${h.at}-${i}`}
                className="rounded-xl border px-4 py-3 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${kindClass(h.kind)}`}
                  >
                    {kindLabel(h.kind)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(h.at)}
                  </span>
                </div>
                <p className="text-sm">{h.summary}</p>
                {h.detail && (
                  <p className="text-xs text-muted-foreground">{h.detail}</p>
                )}
                {h.callId && (
                  <p className="text-xs text-muted-foreground">Call: {h.callId}</p>
                )}
              </div>
            ))}
            {!playbookLoading && !(playbook?.history || []).length && (
              <p className="text-sm text-muted-foreground">
                Abhi koi lesson nahi — calls complete hone ke baad yahan dikhenge.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opener performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Style</th>
                    <th className="py-2 pr-3 font-medium">Uses</th>
                    <th className="py-2 pr-3 font-medium">Wins</th>
                    <th className="py-2 font-medium">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {(playbook?.openerStyles || []).map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 capitalize">
                        {s.id.replace(/_/g, ' ')}
                        {playbook?.preferredOpener === s.id ? ' · preferred' : ''}
                        {playbook?.lastOpener === s.id ? ' · last used' : ''}
                      </td>
                      <td className="py-2 pr-3">{s.uses}</td>
                      <td className="py-2 pr-3">{s.wins}</td>
                      <td className="py-2">{s.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(playbook?.openerStyles || []).length && (
                <p className="text-sm text-muted-foreground">
                  Openers abhi track nahi hue — pehli calls ke baad stats aayenge.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kaise feedback dein</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              1. <strong>Calls</strong> page se call ID copy karo.
            </p>
            <p>
              2. Is page pe feedback / corrected reply submit karo.
            </p>
            <p>
              3. Sirf <strong>Admin</strong> neeche <em>Approve into playbook</em> dabaye —
              tab tip next calls mein use hogi aur timeline pe dikhegi.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit feedback / corrected reply</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm space-y-1">
              <span className="font-medium">Call ID</span>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="cm… (from Calls page)"
                value={form.callId}
                onChange={(e) => setForm((f) => ({ ...f, callId: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm space-y-1">
                <span className="font-medium">Rating</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                >
                  <option value="HELPFUL">HELPFUL</option>
                  <option value="NEUTRAL">NEUTRAL</option>
                  <option value="POOR">POOR</option>
                </select>
              </label>
              <label className="block text-sm space-y-1">
                <span className="font-medium">Category</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="reply / tone / flow"
                />
              </label>
            </div>
            <label className="block text-sm space-y-1">
              <span className="font-medium">Comment / what went wrong</span>
              <textarea
                className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Agent budget pehle poochh raha tha…"
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="font-medium">Corrected reply (better line)</span>
              <textarea
                className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.correctedReply}
                onChange={(e) =>
                  setForm((f) => ({ ...f, correctedReply: e.target.value }))
                }
                placeholder="Accha — configuration kaunsi soch rahe ho, do bedroom ya teen?"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={submitting} onClick={() => void submitFeedback()}>
                {submitting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Submit feedback
              </Button>
              {submitMsg && (
                <p className="text-sm text-muted-foreground">{submitMsg}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calls (30d)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {analytics?.totals?.calls30d ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Site visits</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {analytics?.totals?.siteVisits ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qualified</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {analytics?.totals?.qualified ?? '—'}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending approval (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(pending || []).map((f: any) => (
              <div key={f.id} className="rounded-xl border p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <p className="font-medium">
                    {f.rating} · {f.lead?.name || 'Lead'} · {f.project?.name || 'Project'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by {f.createdBy?.name || 'staff'} · call {f.callId || f.call?.id}
                  </p>
                </div>
                {f.comment && <p className="text-sm">{f.comment}</p>}
                {f.correctedReply && (
                  <p className="text-sm text-muted-foreground">
                    Corrected reply: {f.correctedReply}
                  </p>
                )}
                {user?.role === 'ADMIN' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === f.id}
                      onClick={() => void moderate(f.id, 'APPROVED')}
                    >
                      {busyId === f.id && (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      )}
                      Approve into playbook
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === f.id}
                      onClick={() => void moderate(f.id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!(pending || []).length && (
              <p className="text-sm text-muted-foreground">No pending feedback.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
