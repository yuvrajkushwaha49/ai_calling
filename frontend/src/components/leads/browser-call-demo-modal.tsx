'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Bot,
  User,
  Mic,
  MicOff,
  Send,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEndDemoCall } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { errorMessage } from '@/lib/utils';
import { streamDemoTurn } from '@/lib/stream-demo-turn';

export type BrowserCallDemoData = {
  callId: string;
  leadName: string;
  leadPhone: string;
  agentName: string;
  agentVoice?: string;
  greetingText: string;
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
};

interface BrowserCallDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BrowserCallDemoData | null;
}

type CallPhase = 'ringing' | 'connected' | 'ended';
type ChatMessage = {
  id: string;
  role: 'agent' | 'lead';
  text: string;
};

export function BrowserCallDemoModal({
  open,
  onOpenChange,
  data,
}: BrowserCallDemoModalProps) {
  const token = useAuthStore((s) => s.token);
  const endDemoCall = useEndDemoCall();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const playingQueueRef = useRef(false);
  const agentMsgIdRef = useRef('');

  const [phase, setPhase] = useState<CallPhase>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');

  const drainAudioQueue = async () => {
    if (playingQueueRef.current) return;
    playingQueueRef.current = true;
    while (audioQueueRef.current.length) {
      const src = audioQueueRef.current.shift();
      if (!src) continue;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(src);
      audioRef.current = audio;
      setIsSpeaking(true);
      try {
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });
      } finally {
        setIsSpeaking(false);
      }
    }
    playingQueueRef.current = false;
  };

  const enqueueAudio = (base64?: string, mimeType = 'audio/mpeg') => {
    if (!base64) return;
    audioQueueRef.current.push(`data:${mimeType};base64,${base64}`);
    void drainAudioQueue();
  };

  const playAudio = async (base64?: string, mimeType = 'audio/wav', url?: string) => {
    audioQueueRef.current = [];
    const src = base64 ? `data:${mimeType};base64,${base64}` : url;
    if (!src) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => setIsSpeaking(false);
    try {
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (!open || !data) return;

    setPhase('ringing');
    setElapsed(0);
    setDraft('');
    setError('');
    setIsRecording(false);
    setIsThinking(false);
    audioQueueRef.current = [];
    setMessages([
      {
        id: 'greeting',
        role: 'agent',
        text: data.greetingText,
      },
    ]);

    const ringTimer = window.setTimeout(() => {
      setPhase('connected');
      void playAudio(data.audioBase64, data.mimeType || 'audio/wav', data.audioUrl);
    }, 1500);

    return () => {
      window.clearTimeout(ringTimer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [open, data]);

  useEffect(() => {
    if (!open || phase === 'ended') return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open, phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const runStreamTurn = async (payload: {
    message?: string;
    audioBase64?: string;
    fileName?: string;
  }) => {
    if (!data?.callId || !token) return;
    setIsThinking(true);
    const agentId = `agent-${Date.now()}`;
    agentMsgIdRef.current = agentId;
    setMessages((prev) => [...prev, { id: agentId, role: 'agent', text: '…' }]);

    try {
      await streamDemoTurn(
        token,
        { callId: data.callId, ...payload },
        {
          onEvent: async (event) => {
            if (event.type === 'user' && payload.audioBase64) {
              setMessages((prev) => {
                const next = [...prev];
                const idx = next.findIndex((m) => m.text === '🎤 Voice message…');
                if (idx >= 0) {
                  next[idx] = { ...next[idx], text: event.text || 'Voice message' };
                }
                return next;
              });
            }
            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentId
                    ? {
                        ...m,
                        text: (m.text === '…' ? '' : m.text) + event.delta,
                      }
                    : m,
                ),
              );
            }
            if (event.type === 'sentence') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== agentId) return m;
                  const cur = m.text === '…' ? '' : m.text;
                  const nextText = cur.includes(event.text)
                    ? cur
                    : `${cur}${cur && !/\s$/.test(cur) ? ' ' : ''}${event.text}`.trim();
                  return { ...m, text: nextText || event.text };
                }),
              );
              enqueueAudio(event.audioBase64, event.mimeType || 'audio/mpeg');
            }
            if (event.type === 'done' && event.replyText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentId ? { ...m, text: event.replyText } : m,
                ),
              );
              if (!event.streamed && event.audioBase64) {
                enqueueAudio(event.audioBase64, event.mimeType || 'audio/mpeg');
              }
            }
          },
        },
      );
    } finally {
      setIsThinking(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!data?.callId || !message.trim() || isThinking) return;
    setError('');
    const text = message.trim();
    setDraft('');
    setMessages((prev) => [
      ...prev,
      { id: `lead-${Date.now()}`, role: 'lead', text },
    ]);

    try {
      await runStreamTurn({ message: text });
    } catch (err) {
      setError(errorMessage(err, 'Failed to get AI reply'));
      setMessages((prev) => prev.filter((m) => m.id !== agentMsgIdRef.current));
    }
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read audio recording'));
      reader.readAsDataURL(blob);
    });

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!data?.callId || blob.size < 1000) {
          setError('Recording too short. Hold the mic and speak clearly.');
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `lead-audio-${Date.now()}`,
            role: 'lead',
            text: '🎤 Voice message…',
          },
        ]);

        try {
          const audioBase64 = await blobToBase64(blob);
          await runStreamTurn({
            audioBase64,
            fileName: `mic-${Date.now()}.webm`,
          });
        } catch (err) {
          setError(errorMessage(err, 'Voice reply failed'));
          setMessages((prev) => prev.filter((m) => m.id !== agentMsgIdRef.current));
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone permission denied. You can still type messages.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const endCall = () => {
    if (data?.callId) {
      void endDemoCall.mutateAsync(data.callId);
    }
    setPhase('ended');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b bg-emerald-700 px-5 py-4 text-white">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Phone className="h-4 w-4" />
            Browser call · {data?.leadName || 'Lead'}
          </DialogTitle>
          <DialogDescription className="text-emerald-100">
            {phase === 'ringing' && 'Ringing…'}
            {phase === 'connected' && `Connected · ${formatTime(elapsed)}`}
            {phase === 'ended' && 'Call ended'}
            {data?.agentName ? ` · Agent ${data.agentName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col bg-stone-50">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === 'agent' ? '' : 'flex-row-reverse'}`}
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === 'agent'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {m.role === 'agent' ? (
                    <Bot className="h-3.5 w-3.5" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'agent'
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'bg-sky-600 text-white'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Agent reply streaming…
              </p>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && (
            <p className="border-t bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>
          )}

          {phase === 'connected' && (
            <div className="flex items-center gap-2 border-t bg-white px-3 py-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendMessage(draft);
                }}
                placeholder="Type as customer…"
                disabled={isThinking || isRecording}
              />
              <Button
                size="icon"
                disabled={!draft.trim() || isThinking || isRecording}
                onClick={() => void sendMessage(draft)}
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={isRecording ? 'destructive' : 'outline'}
                disabled={isThinking}
                onClick={() => (isRecording ? stopRecording() : void startRecording())}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="destructive" onClick={endCall}>
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isSpeaking && (
            <p className="border-t px-4 py-1 text-center text-xs text-emerald-700">
              Agent speaking…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
