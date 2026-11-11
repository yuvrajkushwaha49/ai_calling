'use client';

import { useState } from 'react';
import { ExternalLink, FileText, Sparkles, Brain, UserCheck, CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useCalls } from '@/hooks/use-api';
import { formatDate, formatDuration } from '@/lib/utils';
import { CALL_OUTCOME_LABELS } from '@/lib/constants';
import type { Call } from '@/types';

function interestFromCall(call: Call): number | null {
  if (typeof call.interestScore === 'number') return call.interestScore;
  const q = call.qualificationJson;
  if (q && typeof q.interestScore === 'number') return Number(q.interestScore);
  return null;
}

function InterestBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const color =
    score >= 8
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : score >= 5
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {score}/10
    </span>
  );
}

export default function CallsPage() {
  const { data: calls, isLoading, isError, error } = useCalls();
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  return (
    <DashboardLayout title="Call Logs">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      {calls && (
        <div className="panel-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="panel-table w-full text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="px-5 py-3 text-left lg:px-6">Lead</th>
                  <th className="px-5 py-3 text-left lg:px-6">Phone</th>
                  <th className="px-5 py-3 text-left lg:px-6">Duration</th>
                  <th className="px-5 py-3 text-left lg:px-6">Interest</th>
                  <th className="px-5 py-3 text-left lg:px-6">Outcome</th>
                  <th className="px-5 py-3 text-left lg:px-6">Date</th>
                  <th className="px-5 py-3 text-left lg:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr
                    key={call.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-5 py-3.5 font-medium lg:px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          {call.lead?.name || 'Unknown'}
                          {call.conversationMemory?.isReturning && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
                              title="Returning customer recognized from memory"
                            >
                              <Brain className="h-2.5 w-2.5" />
                              Returning
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 lg:px-6">{call.lead?.phone}</td>
                    <td className="px-5 py-3.5 tabular-nums lg:px-6">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="px-5 py-3.5 lg:px-6">
                      <InterestBadge score={interestFromCall(call)} />
                    </td>
                    <td className="px-5 py-3.5 lg:px-6">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {CALL_OUTCOME_LABELS[call.outcome]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground lg:px-6">
                      {formatDate(call.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 lg:px-6">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedCall(call)}>
                          <FileText className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                        {call.recordingUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Recording
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {calls.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                      No call logs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle>Call with {selectedCall.lead?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Call ID:</span>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">{selectedCall.id}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(selectedCall.id)}
                    >
                      Copy ID
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/feedback?callId=${selectedCall.id}`}>Give feedback</a>
                    </Button>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{' '}
                    {formatDuration(selectedCall.duration)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Interest:</span>{' '}
                    <InterestBadge score={interestFromCall(selectedCall)} />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Outcome:</span>{' '}
                    {CALL_OUTCOME_LABELS[selectedCall.outcome]}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>{' '}
                    {formatDate(selectedCall.createdAt)}
                  </div>
                  {selectedCall.recordingUrl && (
                    <div>
                      <a
                        href={selectedCall.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Listen to Recording
                      </a>
                    </div>
                  )}
                </div>

                {selectedCall.summary && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
                      <Sparkles className="h-4 w-4" />
                      AI Call Summary
                    </div>
                    <p className="text-sm text-foreground/90">{selectedCall.summary}</p>
                  </div>
                )}

                {selectedCall.conversationMemory && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-300">
                        <Brain className="h-4 w-4" />
                        Customer Memory & Anti-Repetition State
                      </div>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                        {selectedCall.conversationMemory.isReturning
                          ? 'Returning Customer'
                          : 'New Customer'}
                      </span>
                    </div>

                    {selectedCall.conversationMemory.facts &&
                      typeof selectedCall.conversationMemory.facts === 'object' && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          {Object.entries(
                            selectedCall.conversationMemory.facts as Record<string, any>,
                          )
                            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                            .map(([k, v]) => (
                              <div
                                key={k}
                                className="rounded bg-background/80 p-2 border border-border/40"
                              >
                                <span className="font-medium text-muted-foreground capitalize">
                                  {k.replace(/([A-Z])/g, ' $1')}:
                                </span>{' '}
                                <span className="font-semibold text-foreground">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}

                    {selectedCall.conversationMemory.answeredFields &&
                      selectedCall.conversationMemory.answeredFields.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-muted-foreground">
                            Remembered Answers (Never Re-asked):
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {selectedCall.conversationMemory.answeredFields.map((field) => (
                              <span
                                key={field}
                                className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-[11px] font-medium text-foreground border border-border/50"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <h4 className="mb-2 font-semibold">Transcript</h4>
                    <div className="max-h-64 overflow-y-auto rounded-lg bg-muted/60 p-4 text-sm whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
