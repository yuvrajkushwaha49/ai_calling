'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Link2, FileText, Trash2, Upload } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useProjects, useProjectKnowledge } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { knowledgeService } from '@/services';
import { useQueryClient } from '@tanstack/react-query';

export default function KnowledgePage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const { data: projects, isLoading, isError, error } = useProjects();
  const [projectId, setProjectId] = useState('');
  const { data: sources, isLoading: loadingSources } = useProjectKnowledge(projectId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromQuery = new URLSearchParams(window.location.search).get('projectId');
    if (fromQuery) setProjectId(fromQuery);
  }, []);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [faqTitle, setFaqTitle] = useState('');
  const [faqText, setFaqText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const selected = useMemo(
    () => projects?.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['knowledge', projectId] });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setMsg('');
    try {
      await fn();
      await refresh();
      setMsg('Saved and indexed for this project only.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <DashboardLayout title="Project Knowledge Base">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Project-scoped documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload brochures, FAQs, RERA, price sheets, or website pages. Retrieval is
              isolated per project — Project A data never answers Project B leads.
            </p>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Active knowledge for <strong>{selected.name}</strong> ({selected.builder})
              </p>
            )}
          </CardContent>
        </Card>

        {projectId && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload PDF / text file</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    type="file"
                    accept=".pdf,.txt,.md,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !token) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      fd.append('projectId', projectId);
                      fd.append('title', file.name);
                      void run('upload', () => knowledgeService.upload(token, fd));
                    }}
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" /> PDF brochures, price sheets, FAQs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add website page</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="https://example.com/project"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Button
                    disabled={!url || !!busy}
                    onClick={() =>
                      token &&
                      void run('website', () =>
                        knowledgeService.addWebsite(token, {
                          projectId,
                          url,
                          title: title || undefined,
                        }),
                      )
                    }
                  >
                    {busy === 'website' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    Fetch & index
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paste FAQ / notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Title"
                  value={faqTitle}
                  onChange={(e) => setFaqTitle(e.target.value)}
                />
                <Textarea
                  rows={5}
                  placeholder="Approved project facts only…"
                  value={faqText}
                  onChange={(e) => setFaqText(e.target.value)}
                />
                <Button
                  disabled={!faqTitle || !faqText || !!busy}
                  onClick={() =>
                    token &&
                    void run('text', () =>
                      knowledgeService.addText(token, {
                        projectId,
                        title: faqTitle,
                        text: faqText,
                        sourceType: 'FAQ',
                      }),
                    )
                  }
                >
                  {busy === 'text' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Save FAQ
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Indexed sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingSources && <PageLoader />}
                {(sources || []).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.sourceType} · {s.status}
                        {s._count?.chunks != null ? ` · ${s._count.chunks} chunks` : ''}
                        {s.sourceUrl ? ` · ${s.sourceUrl}` : ''}
                        {s.fileName ? ` · ${s.fileName}` : ''}
                      </p>
                      {s.errorMessage && (
                        <p className="text-xs text-destructive">{s.errorMessage}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        token &&
                        void run('delete', () => knowledgeService.remove(token, s.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {!loadingSources && !(sources || []).length && (
                  <p className="text-sm text-muted-foreground">No documents yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {msg && <p className="text-center text-sm text-muted-foreground">{msg}</p>}
      </div>
    </DashboardLayout>
  );
}
