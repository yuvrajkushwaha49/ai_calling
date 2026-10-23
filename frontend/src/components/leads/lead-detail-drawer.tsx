'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  Mail,
  PhoneCall,
  PhoneOff,
  Loader2,
  Bot,
  User,
  Mic,
  MicOff,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/common/status-badge';
import { useUiStore } from '@/stores/ui-store';
import {
  useLead,
  useStartOutboundCall,
  useEndDemoCall,
  useAiSettings,
  useTwilioStatus,
  useMcubeStatus,
} from '@/hooks/use-api';
import { formatCurrency, errorMessage } from '@/lib/utils';
import {
  LEAD_SOURCE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/lib/constants';
import { PageLoader } from '@/components/common/loading';
import { useAuthStore } from '@/stores/auth-store';
import { streamDemoTurn } from '@/lib/stream-demo-turn';

type ChatMessage = {
  id: string;
  role: 'agent' | 'lead';
  text: string;
};

export function LeadDetailDrawer() {
  const { selectedLead, leadDrawerOpen, closeLeadDrawer } = useUiStore();
  const { data: lead, isLoading, isError, error } = useLead(selectedLead?.id || '');
  const { data: aiSettings } = useAiSettings();
  const { data: twilioStatus } = useTwilioStatus();
  const { data: mcubeStatus } = useMcubeStatus();
  const startCall = useStartOutboundCall();
  const endDemoCall = useEndDemoCall();
  const token = useAuthStore((s) => s.token);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const startListeningRef = useRef<(mode?: 'normal' | 'bargeIn') => void>(() => {});
  const callIdRef = useRef<string | null>(null);
  const listeningWantedRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const finalSpeechRef = useRef('');
  const isSpeakingRef = useRef(false);
  const sendTimerRef = useRef<number | null>(null);
  const ignoreEchoUntilRef = useRef(0);
  const sendingRef = useRef(false);
  const lastSentTextRef = useRef('');
  const lastAgentTextRef = useRef('');
  const bargeInActiveRef = useRef(false);
  const listenModeRef = useRef<'normal' | 'bargeIn'>('normal');
  /** false only when customer explicitly mutes */
  const micOpenRef = useRef(true);
  const audioQueueRef = useRef<string[]>([]);
  const playingQueueRef = useRef(false);
  const streamListenAfterRef = useRef(false);

  const normalizeSpeech = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** Soft echo check — only block near-copies of agent TTS, not normal customer words */
  const isAgentEchoContent = (heard: string) => {
    const agent = normalizeSpeech(lastAgentTextRef.current);
    const user = normalizeSpeech(heard);
    if (!user) return true;

    // Exact lead name alone (common TTS leak)
    const leadName = normalizeSpeech(displayLead?.name || '');
    if (leadName && user === leadName) return true;

    if (!agent) return false;

    // Full / near-full copy of what agent just said
    if (user.length >= 12 && (agent === user || agent.includes(user))) {
      // Only if user is a long chunk of agent text (not a short answer that appears inside)
      if (user.length >= Math.min(40, Math.floor(agent.length * 0.35))) return true;
    }
    if (user.length >= 20 && user.includes(agent.slice(0, Math.min(60, agent.length)))) {
      return true;
    }

    // Very high token overlap with long agent line
    const aw = new Set(agent.split(' ').filter((w) => w.length > 3));
    const uw = user.split(' ').filter((w) => w.length > 3);
    if (uw.length >= 5 && aw.size >= 5) {
      const hits = uw.filter((w) => aw.has(w)).length;
      if (hits / uw.length >= 0.85) return true;
    }
    return false;
  };

  const looksLikeAgentEcho = (heard: string) => isAgentEchoContent(heard);

  const [callId, setCallId] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micOpen, setMicOpen] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [callError, setCallError] = useState('');
  const [phoneCallNotice, setPhoneCallNotice] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const displayLead = lead || selectedLead;

  useEffect(() => {
    if (!leadDrawerOpen) {
      stopAudio();
      micOpenRef.current = false;
      stopListening();
      setMicOpen(false);
      setInCall(false);
      setCallId(null);
      callIdRef.current = null;
      setMessages([]);
      setDraft('');
      setCallError('');
      setElapsed(0);
      setLiveTranscript('');
    }
  }, [leadDrawerOpen]);

  useEffect(() => {
    if (!inCall) return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const stopAudio = () => {
    audioQueueRef.current = [];
    playingQueueRef.current = false;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  };

  const ensureMicAfterSpeak = () => {
    if (!streamListenAfterRef.current || !micOpenRef.current || !callIdRef.current) return;
    ignoreEchoUntilRef.current = Date.now() + 350;
    listeningWantedRef.current = false;
    stopListeningKeepMic();
    window.setTimeout(() => startListeningRef.current('bargeIn'), 400);
  };

  const drainAudioQueue = async () => {
    if (playingQueueRef.current) return;
    playingQueueRef.current = true;
    while (audioQueueRef.current.length) {
      const src = audioQueueRef.current.shift();
      if (!src) continue;
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(src);
      audio.volume = 0.7;
      audioRef.current = audio;
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      ignoreEchoUntilRef.current = Date.now() + 500;
      if (streamListenAfterRef.current && micOpenRef.current) {
        window.setTimeout(() => {
          if (callIdRef.current && micOpenRef.current) {
            listeningWantedRef.current = false;
            stopListeningKeepMic();
            startListeningRef.current('bargeIn');
          }
        }, 350);
      }
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    }
    playingQueueRef.current = false;
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    ensureMicAfterSpeak();
  };

  const enqueueStreamAudio = (base64?: string, mimeType = 'audio/mpeg') => {
    if (!base64) return;
    audioQueueRef.current.push(`data:${mimeType};base64,${base64}`);
    void drainAudioQueue();
  };

  const clearSendTimer = () => {
    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
  };

  const playAudio = async (
    base64?: string,
    mimeType = 'audio/wav',
    url?: string,
    options?: { listenAfter?: boolean },
  ) => {
    const src = base64 ? `data:${mimeType};base64,${base64}` : url;

    clearSendTimer();
    bargeInActiveRef.current = false;
    finalSpeechRef.current = '';
    setLiveTranscript('');

    // Force a clean recognition restart after / during TTS
    listeningWantedRef.current = false;
    stopListeningKeepMic();
    setIsListening(false);

    const ensureMic = () => {
      if (!micOpenRef.current || !callIdRef.current) return;
      // Force start even if flags look stale
      listeningWantedRef.current = false;
      stopListeningKeepMic();
      startListeningRef.current('bargeIn');
    };

    if (!src) {
      if (options?.listenAfter && micOpenRef.current) {
        ignoreEchoUntilRef.current = Date.now() + 300;
        window.setTimeout(ensureMic, 350);
      }
      return;
    }

    stopAudio();
    const audio = new Audio(src);
    audio.volume = 0.7;
    audioRef.current = audio;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    // Brief ignore of speaker bleed only
    ignoreEchoUntilRef.current = Date.now() + 500;

    const afterSpeak = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      ignoreEchoUntilRef.current = Date.now() + 350;
      if (options?.listenAfter && micOpenRef.current) {
        window.setTimeout(ensureMic, 400);
      }
    };
    audio.onended = afterSpeak;
    audio.onerror = () => {
      afterSpeak();
    };
    try {
      await audio.play();
      // Open mic while AI talks so customer can interrupt
      if (options?.listenAfter && micOpenRef.current) {
        window.setTimeout(() => {
          if (callIdRef.current && micOpenRef.current) ensureMic();
        }, 350);
      }
    } catch {
      afterSpeak();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartCall = async (
    provider: 'browser-demo' | 'twilio' | 'mcube',
  ) => {
    if (!displayLead?.id) return;
    setCallError('');
    setPhoneCallNotice('');
    try {
      const browserDemo = provider === 'browser-demo';
      const result = await startCall.mutateAsync({
        leadId: displayLead.id,
        browserDemo,
        provider,
      });

      // Live phone call — ring the lead's handset
      if (!browserDemo || result.demoMode === false) {
        setPhoneCallNotice(
          `Calling ${displayLead.phone} via ${provider.toUpperCase()}… ${result.providerCallId ? `ID: ${result.providerCallId}` : ''}. Check Call Logs for live status.`,
        );
        return;
      }

      const greeting =
        result.greetingText ||
        result.transcript ||
        `Hello ${displayLead.name}, this is your AI real estate agent.`;
      setCallId(result.id);
      callIdRef.current = result.id;
      setInCall(true);
      setElapsed(0);
      setMessages([{ id: 'greeting', role: 'agent', text: greeting }]);
      lastAgentTextRef.current = greeting;
      lastSentTextRef.current = '';
      sendingRef.current = false;
      micOpenRef.current = true;
      setMicOpen(true);
      await playAudio(
        result.audioBase64,
        result.mimeType || 'audio/wav',
        result.audioUrl || result.recordingUrl || undefined,
        { listenAfter: true },
      );
    } catch (err) {
      setCallError(errorMessage(err, 'Failed to start call'));
    }
  };

  const releaseMicStream = () => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  };

  const stopListeningKeepMic = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  const stopListening = () => {
    listeningWantedRef.current = false;
    bargeInActiveRef.current = false;
    listenModeRef.current = 'normal';
    clearSendTimer();
    stopListeningKeepMic();
    releaseMicStream();
    setIsListening(false);
  };

  /** Pause recognition only — mic stays "open" unless customer muted */
  const pauseRecognitionOnly = () => {
    listeningWantedRef.current = false;
    clearSendTimer();
    stopListeningKeepMic();
    setIsListening(false);
  };

  const muteMic = () => {
    micOpenRef.current = false;
    setMicOpen(false);
    stopListening();
  };

  const unmuteMic = () => {
    micOpenRef.current = true;
    setMicOpen(true);
    void startListening('bargeIn');
  };

  const sendMessage = async (message: string) => {
    const activeCallId = callIdRef.current;
    const text = message.trim();
    if (!activeCallId || !text || isStreaming || sendingRef.current || !token) return;

    const normalized = normalizeSpeech(text);
    if (normalized && normalized === lastSentTextRef.current) return;
    if (looksLikeAgentEcho(text)) {
      // Only drop near-full agent copies; never drop normal answers
      setLiveTranscript('');
      finalSpeechRef.current = '';
      return;
    }

    sendingRef.current = true;
    bargeInActiveRef.current = false;
    lastSentTextRef.current = normalized;
    setDraft('');
    setLiveTranscript('');
    finalSpeechRef.current = '';
    setCallError('');
    clearSendTimer();
    stopAudio();
    pauseRecognitionOnly();
    setIsStreaming(true);
    streamListenAfterRef.current = true;
    const agentId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `lead-${Date.now()}`, role: 'lead', text },
      { id: agentId, role: 'agent', text: '…' },
    ]);

    try {
      const done = await streamDemoTurn(
        token,
        { callId: activeCallId, message: text },
        {
          onEvent: async (event) => {
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
              enqueueStreamAudio(event.audioBase64, event.mimeType || 'audio/mpeg');
            }
            if (event.type === 'done') {
              lastAgentTextRef.current = event.replyText || '';
              if (event.replyText) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentId ? { ...m, text: event.replyText } : m,
                  ),
                );
              }
              if (!event.streamed && event.audioBase64) {
                enqueueStreamAudio(event.audioBase64, event.mimeType || 'audio/mpeg');
              }
            }
          },
        },
      );
      lastAgentTextRef.current = done.replyText || lastAgentTextRef.current;
      sendingRef.current = false;
    } catch (err) {
      setCallError(errorMessage(err, 'Failed to get AI reply'));
      lastSentTextRef.current = '';
      setMessages((prev) => prev.filter((m) => m.id !== agentId));
      sendingRef.current = false;
      if (micOpenRef.current) {
        window.setTimeout(() => startListeningRef.current('bargeIn'), 300);
      }
    } finally {
      setIsStreaming(false);
      sendingRef.current = false;
    }
  };

  const startListening = async (mode: 'normal' | 'bargeIn' = 'normal') => {
    if (!callIdRef.current) return;
    if (!micOpenRef.current) return;
    // Don't start a second send-loop while API in flight (bargeIn during TTS is OK)
    if (sendingRef.current && mode !== 'bargeIn') return;

    listenModeRef.current = mode;

    // Already listening — keep always-on
    if (listeningWantedRef.current && recognitionRef.current) {
      return;
    }

    setCallError('');
    if (!bargeInActiveRef.current && mode === 'normal') {
      setLiveTranscript('');
      finalSpeechRef.current = '';
      clearSendTimer();
    }

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setCallError(
        'Chrome browser use karein (Edge/Chrome). Is browser me voice listen support nahi hai — type karke bhejein.',
      );
      return;
    }

    try {
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    } catch {
      setCallError(
        'Microphone allow nahi hua. Address bar me lock icon → Microphone → Allow, phir green mic dabayein.',
      );
      setIsListening(false);
      return;
    }

    stopListeningKeepMic();

    listeningWantedRef.current = true;
    const recognition = new SpeechRecognitionCtor();
    const appLang = aiSettings?.language || 'hi-IN';
    recognition.lang =
      appLang === 'en-IN' ? 'en-IN' : appLang === 'gu-IN' ? 'gu-IN' : 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setCallError('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Ignore only the first moments of TTS playback (speaker bleed)
      if (
        isSpeakingRef.current &&
        !bargeInActiveRef.current &&
        Date.now() < ignoreEchoUntilRef.current
      ) {
        return;
      }

      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }

      const chunk = `${finalText} ${interim}`.trim();
      if (!chunk) return;

      // While AI talks: customer speech → stop AI and keep listening
      if (isSpeakingRef.current && !bargeInActiveRef.current) {
        if (isAgentEchoContent(chunk)) return;
        // Any real non-echo speech interrupts
        if (normalizeSpeech(chunk).length < 2) return;
        stopAudio();
        bargeInActiveRef.current = true;
        ignoreEchoUntilRef.current = 0;
        setCallError('');
      }

      if (isAgentEchoContent(chunk) && !finalSpeechRef.current) {
        // Pure echo — ignore
        return;
      }

      if (finalText.trim() && !isAgentEchoContent(finalText.trim())) {
        finalSpeechRef.current = `${finalSpeechRef.current} ${finalText}`.trim();
      } else if (finalText.trim() && isAgentEchoContent(finalText.trim())) {
        // skip echo final
      }

      const live = (finalSpeechRef.current || interim || finalText).trim();
      if (live) setLiveTranscript(live);

      const ready = finalSpeechRef.current.trim();
      // Send on final result (with or without lingering interim cleared)
      if (ready && !interim) {
        if (isAgentEchoContent(ready)) {
          finalSpeechRef.current = '';
          setLiveTranscript('');
          return;
        }
        clearSendTimer();
        sendTimerRef.current = window.setTimeout(() => {
          if (!listeningWantedRef.current || sendingRef.current) return;
          if (isSpeakingRef.current && !bargeInActiveRef.current) return;
          const text = finalSpeechRef.current.trim();
          if (!text || isAgentEchoContent(text)) {
            finalSpeechRef.current = '';
            setLiveTranscript('');
            return;
          }
          listeningWantedRef.current = false;
          bargeInActiveRef.current = false;
          setIsListening(false);
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          void sendMessage(text);
        }, 700);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        listeningWantedRef.current = false;
        setIsListening(false);
        setCallError(
          'Microphone blocked. Chrome address bar → lock → Microphone Allow karein.',
        );
      } else if (event.error === 'no-speech') {
        if (!isSpeakingRef.current) {
          setCallError('Awaaz nahi mili — thoda zor se bolein, ya type karein.');
        }
      } else if (event.error !== 'aborted') {
        if (!isSpeakingRef.current) {
          setCallError(`Voice error: ${event.error}. Mic auto-retry…`);
        }
        // Keep always-on mic alive
        if (micOpenRef.current) {
          listeningWantedRef.current = true;
          window.setTimeout(() => {
            if (micOpenRef.current && callIdRef.current) {
              try {
                recognition.start();
              } catch {
                void startListeningRef.current('bargeIn');
              }
            }
          }, 400);
        } else {
          listeningWantedRef.current = false;
          setIsListening(false);
        }
      }
    };

    recognition.onend = () => {
      if (
        micOpenRef.current &&
        listeningWantedRef.current &&
        callIdRef.current &&
        !isStreaming
      ) {
        try {
          recognition.start();
          setIsListening(true);
          return;
        } catch {
          window.setTimeout(() => {
            if (micOpenRef.current) startListeningRef.current('bargeIn');
          }, 250);
          return;
        }
      }
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      if (mode !== 'bargeIn') {
        setCallError('Mic start nahi hua. Green mic button dabayein ya type karein.');
      }
      listeningWantedRef.current = false;
      setIsListening(false);
    }
  };

  startListeningRef.current = (mode) => {
    void startListening(mode || 'normal');
  };

  const endCall = () => {
    const id = callIdRef.current || callId;
    if (id) {
      endDemoCall.mutate(id);
    }
    stopAudio();
    micOpenRef.current = false;
    setMicOpen(false);
    stopListening();
    setInCall(false);
    setCallId(null);
    callIdRef.current = null;
    setLiveTranscript('');
  };

  return (
    <Sheet
      open={leadDrawerOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (callIdRef.current || callId) endCall();
          closeLeadDrawer();
        }
      }}
    >      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b px-6 py-4">
          <SheetHeader className="space-y-3 text-left">
            <SheetTitle className="text-xl">
              {displayLead?.name || 'Lead details'}
            </SheetTitle>
            {displayLead && (
              <div className="flex flex-wrap items-center gap-2">
                {'status' in displayLead && displayLead.status ? (
                  <StatusBadge status={displayLead.status} />
                ) : null}
                {'source' in displayLead && displayLead.source ? (
                <span className="text-sm text-muted-foreground">
                    {LEAD_SOURCE_LABELS[displayLead.source] || displayLead.source}
                </span>
                ) : null}
              </div>
            )}
            </SheetHeader>

          {displayLead && (
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                {displayLead.phone}
              </div>
              {'email' in displayLead && displayLead.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  {displayLead.email}
                </div>
              ) : null}
              {'budget' in displayLead && displayLead.budget ? (
                <div>
                  <span className="text-muted-foreground">Budget: </span>
                  {formatCurrency(Number(displayLead.budget))}
                  <span className="ml-1 text-xs text-muted-foreground">(from call)</span>
                  </div>
              ) : (
                <div className="text-muted-foreground">
                  Budget: not yet — AI will ask on the call
                  </div>
                )}
              {'propertyType' in displayLead && displayLead.propertyType ? (
                <div>
                    <span className="text-muted-foreground">Type: </span>
                  {PROPERTY_TYPE_LABELS[displayLead.propertyType] || displayLead.propertyType}
                </div>
              ) : null}
                  </div>
                )}

          {isError && (
            <p className="mt-3 text-xs text-amber-600">
              Could not load full lead details
              {error instanceof Error ? `: ${error.message}` : ''}. You can still start a demo call.
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          {isLoading && !displayLead ? (
            <PageLoader />
          ) : !inCall ? (
            <div className="flex flex-1 flex-col justify-center gap-4">
              <div className="rounded-xl border border-border/80 bg-card p-5">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Call with AI</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browser demo stays in-app. Twilio rings the lead&apos;s real phone.
                </p>
                <p className="mt-3 text-sm">
                    <span className="text-muted-foreground">Project: </span>
                  {(lead as { project?: { name?: string }; projectId?: string } | undefined)?.project?.name ||
                    'Not linked — agent will ask which property on the call'}
                </p>
                {twilioStatus && (
                  <div
                    className={`mt-3 space-y-1 text-xs ${
                      twilioStatus.webhookReady
                        ? 'text-primary'
                        : twilioStatus.configured
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    <p>
                      Twilio: {twilioStatus.message}
                      {twilioStatus.fromNumber
                        ? ` · From ${twilioStatus.fromNumber}`
                        : ''}
                    </p>
                    {twilioStatus.webhookReady ? (
                      <p className="break-all text-muted-foreground">
                        Voice webhook: {twilioStatus.webhookVoice}
                      </p>
                    ) : null}
                  </div>
                )}
                {mcubeStatus && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">MCube:</span>{' '}
                      {mcubeStatus.message}
                    </p>
                    <p className="break-all text-muted-foreground">
                      WSS: {mcubeStatus.websocketUrlTemplate}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleStartCall('browser-demo')}
                  disabled={
                    startCall.isPending ||
                    !displayLead?.id
                  }
                  className="h-11 w-full"
                  variant="outline"
                >
                  {startCall.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-5 w-5" />
                  )}
                  Browser demo
                </Button>
                <Button
                  onClick={() => handleStartCall('mcube')}
                  disabled={
                    startCall.isPending ||
                    !displayLead?.id
                  }
                  className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {startCall.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <PhoneCall className="mr-2 h-5 w-5" />
                  )}
                  Call phone (MCube Telephony)
                </Button>
                <Button
                  onClick={() => handleStartCall('twilio')}
                  disabled={
                    startCall.isPending ||
                    !displayLead?.id ||
                    !twilioStatus?.configured
                  }
                  className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {startCall.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <PhoneCall className="mr-2 h-5 w-5" />
                  )}
                  Call phone (Twilio)
                </Button>
              </div>
              {phoneCallNotice && (
                <p className="text-sm text-primary">{phoneCallNotice}</p>
              )}
              {callError && <p className="text-sm text-destructive">{callError}</p>}
                    </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 ${
                      isSpeaking || isListening ? 'animate-pulse' : ''
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Live AI Call</p>
                    <p className="text-xs text-slate-300">
                      {!micOpen
                        ? 'Mic muted — open mic to speak'
                        : isSpeaking && isListening
                          ? 'Mic on — beech mein bolkar interrupt kar sakte ho'
                          : isSpeaking
                            ? 'Agent speaking… (mic on)'
                            : isListening
                              ? 'Mic on — listening…'
                              : 'Mic on — connecting…'}
                    </p>
                  </div>
                </div>
                <p className="font-mono text-sm text-cyan-300">{formatTime(elapsed)}</p>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === 'lead' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'agent' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                        <Bot className="h-4 w-4 text-cyan-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'agent'
                          ? 'bg-background border'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === 'lead' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      )}
                    </div>
                  ))}
                {isListening && liveTranscript && (
                  <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                    Hearing: {liveTranscript}
                  </div>
                )}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Agent reply streaming…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type reply… e.g. Yes I am interested"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void sendMessage(draft);
                      }
                    }}
                    disabled={isStreaming}
                  />
                  <Button
                    type="button"
                    disabled={!draft.trim() || isStreaming}
                    onClick={() => void sendMessage(draft)}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={micOpen ? 'destructive' : 'default'}
                    className={micOpen ? '' : 'bg-emerald-600 hover:bg-emerald-500'}
                    disabled={isStreaming}
                    onClick={() => {
                      if (micOpen) muteMic();
                      else unmuteMic();
                    }}
                    title={micOpen ? 'Mute mic' : 'Unmute mic'}
                  >
                    {micOpen ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mic call start se open rehta hai — bina button dabaye bol sakte ho. Band karna ho to red mic dabao.
                </p>
                {callError && <p className="text-xs text-destructive">{callError}</p>}
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={endCall}
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  End Call
                </Button>
            </div>
          </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
