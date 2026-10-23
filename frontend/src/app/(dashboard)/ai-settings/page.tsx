'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Upload, Loader2, Volume2 } from 'lucide-react';
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
import {
  useAiSettings,
  useUpdateAiSettings,
  usePreviewVoice,
} from '@/hooks/use-api';
import { aiSettingsSchema, type AiSettingsFormData } from '@/lib/validations';
import { VOICE_OPTIONS, LANGUAGE_OPTIONS, TONE_OPTIONS, CHATGPT_MODEL_OPTIONS, WORKING_DAYS } from '@/lib/constants';

const PREVIEW_TEXT: Record<string, (name: string) => string> = {
  'en-IN': (name) =>
    `Hello, this is ${name} from our real estate team. How can I help you today?`,
  'hi-IN': (name) =>
    `नमस्ते, मैं ${name} बोल रहा हूँ, real estate team से। आज कैसे help करूँ?`,
  hinglish: (name) =>
    `नमस्ते, मैं ${name} बोल रहा हूँ, real estate team से। आज कैसे help करूँ?`,
  'mr-IN': (name) =>
    `नमस्कार, मी ${name} आहे, आमच्या रिअल एस्टेट टीममधून. मी तुम्हाला कशी मदत करू शकतो?`,
  'gu-IN': (name) =>
    `નમસ્તે, હું ${name} છું, અમારી રિયલ એસ્ટેટ ટીમ તરફથી. હું તમારી કેવી રીતે મદદ કરી શકું?`,
};

export default function AiSettingsPage() {
  const { data: settings, isLoading, isError, error } = useAiSettings();
  const updateSettings = useUpdateAiSettings();
  const previewVoice = usePreviewVoice();
  const [previewError, setPreviewError] = useState('');

  const form = useForm<AiSettingsFormData>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      agentName: '',
      agentVoice: 'custom',
      language: 'hi-IN',
      tone: 'friendly',
      llmModel: 'gemini-flash-lite-latest',
      systemPrompt: '',
      workingHours: { start: '09:00', end: '18:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      isActive: true,
    },
  });

  useEffect(() => {
    if (settings) {
      const hours = (settings.workingHours || {}) as Partial<AiSettingsFormData['workingHours']>;
      form.reset({
        agentName: settings.agentName || '',
        agentVoice: settings.agentVoice || 'custom',
        language: (settings.language as AiSettingsFormData['language']) || 'hi-IN',
        tone: (settings.tone as AiSettingsFormData['tone']) || 'friendly',
        llmModel: (settings.llmModel as AiSettingsFormData['llmModel']) || 'gemini-flash-lite-latest',
        systemPrompt: settings.systemPrompt || '',
        workingHours: {
          start: hours.start || '09:00',
          end: hours.end || '18:00',
          days: hours.days || ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
        isActive: settings.isActive ?? true,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: AiSettingsFormData) => {
    updateSettings.mutate(data);
  };

  const toggleDay = (day: string) => {
    const current = form.getValues('workingHours.days') || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    form.setValue('workingHours.days', updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).map((f) => f.name);
    if (files.length) {
      console.log('Files to upload:', files);
    }
  };

  const handlePreviewVoice = async () => {
    setPreviewError('');
    try {
      const language = form.getValues('language');
      const agentName = form.getValues('agentName') || 'your AI agent';
      const sample =
        PREVIEW_TEXT[language]?.(agentName) || PREVIEW_TEXT['en-IN'](agentName);
      const result = await previewVoice.mutateAsync({
        speaker: form.getValues('agentVoice'),
        language,
        text: sample,
      });
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      await audio.play();
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : 'Failed to preview voice',
      );
    }
  };

  const voiceOptions =
    (settings as unknown as { ttsVoices?: typeof VOICE_OPTIONS })?.ttsVoices?.length
      ? (settings as unknown as { ttsVoices: typeof VOICE_OPTIONS }).ttsVoices
      : VOICE_OPTIONS;
  const ttsProvider =
    (settings as unknown as { ttsProvider?: string })?.ttsProvider || 'elevenlabs';

  return (
    <DashboardLayout title="AI Agent Settings">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      {settings && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Agent Name</Label>
                  <Input {...form.register('agentName')} />
                </div>
                <div className="space-y-2">
                  <Label>ElevenLabs Voice</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.watch('agentVoice') || 'custom'}
                      onValueChange={(v) => form.setValue('agentVoice', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {voiceOptions.map((v) => (
                          <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreviewVoice}
                      disabled={previewVoice.isPending}
                      className="shrink-0"
                    >
                      {previewVoice.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    TTS + STT both use ElevenLabs (Scribe for speech-to-text). Voice ID from ELEVENLABS_DEFAULT_VOICE_ID.
                  </p>
                  {previewError && (
                    <p className="text-xs text-destructive">{previewError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={form.watch('language')}
                    onValueChange={(v) =>
                      form.setValue('language', v as AiSettingsFormData['language'])
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Agent greets and replies in this language (Hindi, English, Hinglish, Marathi, Gujarati).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={form.watch('tone')}
                    onValueChange={(v) =>
                      form.setValue('tone', v as AiSettingsFormData['tone'])
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {TONE_OPTIONS.find((t) => t.value === form.watch('tone'))?.description}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.watch('isActive') ? 'active' : 'inactive'}
                    onValueChange={(v) => form.setValue('isActive', v === 'active')}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tone & Language Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose how Aria speaks on calls. Language controls the script; tone controls the style.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TONE_OPTIONS.map((t) => {
                  const selected = form.watch('tone') === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => form.setValue('tone', t.value as AiSettingsFormData['tone'])}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {LANGUAGE_OPTIONS.map((l) => {
                  const selected = form.watch('language') === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() =>
                        form.setValue('language', l.value as AiSettingsFormData['language'])
                      }
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gemini Conversation Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  settings?.llmConfigured
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                }`}
              >
                {settings?.llmConfigured ? (
                  <>
                    {settings.llmProvider === 'gemini' ? 'Gemini' : 'ChatGPT'}{' '}
                    connected — calls will use the selected model.
                  </>
                ) : (
                  <>
                    LLM not connected. Add <code className="text-xs">GEMINI_API_KEY</code> in{' '}
                    <code className="text-xs">backend/.env</code>, then restart the API. Without
                    the key, replies fall back to scripts.
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={form.watch('llmModel')}
                  onValueChange={(v) =>
                    form.setValue('llmModel', v as AiSettingsFormData['llmModel'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHATGPT_MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {
                    CHATGPT_MODEL_OPTIONS.find((m) => m.value === form.watch('llmModel'))
                      ?.description
                  }
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CHATGPT_MODEL_OPTIONS.map((m) => {
                  const selected = form.watch('llmModel') === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() =>
                        form.setValue('llmModel', m.value as AiSettingsFormData['llmModel'])
                      }
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...form.register('systemPrompt')}
                rows={8}
                placeholder="Define how your AI agent should behave during calls..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={form.watch('workingHours.start') || ''}
                    onChange={(e) =>
                      form.setValue('workingHours', {
                        start: e.target.value,
                        end: form.getValues('workingHours.end') || '18:00',
                        days: form.getValues('workingHours.days') || [],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={form.watch('workingHours.end') || ''}
                    onChange={(e) =>
                      form.setValue('workingHours', {
                        start: form.getValues('workingHours.start') || '09:00',
                        end: e.target.value,
                        days: form.getValues('workingHours.days') || [],
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {WORKING_DAYS.map((day) => {
                    const selected = form.watch('workingHours.days')?.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload project brochures, pricing sheets, and FAQs
                </p>
                <Input
                  type="file"
                  multiple
                  className="mt-4"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt"
                />
              </div>
              {settings.knowledgeBase?.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Files</Label>
                  {settings.knowledgeBase.map((file) => (
                    <div key={file} className="rounded-lg bg-muted px-3 py-2 text-sm">
                      {file}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700"
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>

          {updateSettings.isSuccess && (
            <p className="text-center text-sm text-green-600">Settings saved successfully!</p>
          )}
        </form>
      )}
    </DashboardLayout>
  );
}
