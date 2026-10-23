import type { OpenerLearning } from '../calls/opener-bank';
import {
  isOpeningStyleTip,
  parseOpenerLearning,
  personalizeOpeningTip,
} from '../calls/opener-bank';

export { isOpeningStyleTip, personalizeOpeningTip } from '../calls/opener-bank';

export type PlaybookTip = {
  note: string;
  rating?: string;
  source: 'feedback' | 'auto';
  at: string;
};

export type AutoLesson = {
  lesson: string;
  outcome: string;
  at: string;
  callId?: string;
};

export type ImprovementKind =
  | 'auto_lesson'
  | 'feedback_tip'
  | 'opener_preferred';

export type ImprovementEvent = {
  at: string;
  kind: ImprovementKind;
  summary: string;
  detail?: string;
  callId?: string;
};

export type AgentPlaybook = {
  openerLearning?: OpenerLearning;
  tips?: PlaybookTip[];
  autoLessons?: AutoLesson[];
  /** Timeline of when/what the agent improved (newest last). */
  improvementHistory?: ImprovementEvent[];
};

export function appendImprovement(
  playbook: AgentPlaybook,
  event: Omit<ImprovementEvent, 'at'> & { at?: string },
): AgentPlaybook {
  const history = [...(playbook.improvementHistory || [])];
  history.push({
    at: event.at || new Date().toISOString(),
    kind: event.kind,
    summary: event.summary.slice(0, 280),
    detail: event.detail?.slice(0, 400),
    callId: event.callId,
  });
  playbook.improvementHistory = history.slice(-80);
  return playbook;
}

export function normalizePlaybook(raw: unknown): AgentPlaybook {
  if (!raw) return { tips: [], autoLessons: [] };

  // Legacy: plain array of tip-like objects
  if (Array.isArray(raw)) {
    const tips: PlaybookTip[] = raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        const note = String(o.note || o.reply || o.lesson || '').trim();
        if (!note) return null;
        return {
          note: note.slice(0, 280),
          rating: o.rating != null ? String(o.rating) : undefined,
          source: (o.source === 'auto' ? 'auto' : 'feedback') as 'feedback' | 'auto',
          at: String(o.approvedAt || o.at || new Date().toISOString()),
        };
      })
      .filter(Boolean) as PlaybookTip[];
    return { tips, autoLessons: [], improvementHistory: [] };
  }

  if (typeof raw !== 'object') return { tips: [], autoLessons: [], improvementHistory: [] };
  const obj = raw as Record<string, unknown>;
  const tipsRaw = Array.isArray(obj.tips) ? obj.tips : [];
  const lessonsRaw = Array.isArray(obj.autoLessons) ? obj.autoLessons : [];
  const histRaw = Array.isArray(obj.improvementHistory)
    ? obj.improvementHistory
    : [];

  const tips: PlaybookTip[] = tipsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const note = String(o.note || o.reply || '').trim();
      if (!note) return null;
      return {
        note: note.slice(0, 280),
        rating: o.rating != null ? String(o.rating) : undefined,
        source: (o.source === 'auto' ? 'auto' : 'feedback') as 'feedback' | 'auto',
        at: String(o.at || new Date().toISOString()),
      };
    })
    .filter(Boolean) as PlaybookTip[];

  const autoLessons: AutoLesson[] = lessonsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const lesson = String(o.lesson || '').trim();
      if (!lesson) return null;
      return {
        lesson: lesson.slice(0, 280),
        outcome: String(o.outcome || 'CONNECTED'),
        at: String(o.at || new Date().toISOString()),
        callId: o.callId ? String(o.callId) : undefined,
      };
    })
    .filter(Boolean) as AutoLesson[];

  const improvementHistory: ImprovementEvent[] = histRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const summary = String(o.summary || o.lesson || o.note || '').trim();
      if (!summary) return null;
      const kindRaw = String(o.kind || 'auto_lesson');
      const kind: ImprovementKind =
        kindRaw === 'feedback_tip' || kindRaw === 'opener_preferred'
          ? kindRaw
          : 'auto_lesson';
      return {
        at: String(o.at || new Date().toISOString()),
        kind,
        summary: summary.slice(0, 280),
        detail: o.detail != null ? String(o.detail).slice(0, 400) : undefined,
        callId: o.callId ? String(o.callId) : undefined,
      };
    })
    .filter(Boolean) as ImprovementEvent[];

  // Backfill timeline from lessons/tips if history empty (older data)
  if (!improvementHistory.length) {
    for (const l of autoLessons) {
      improvementHistory.push({
        at: l.at,
        kind: 'auto_lesson',
        summary: l.lesson,
        detail: `Outcome: ${l.outcome}`,
        callId: l.callId,
      });
    }
    for (const t of tips) {
      improvementHistory.push({
        at: t.at,
        kind: 'feedback_tip',
        summary: t.note,
        detail: t.rating ? `Rating: ${t.rating}` : undefined,
      });
    }
    improvementHistory.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }

  return {
    openerLearning: parseOpenerLearning(obj),
    tips,
    autoLessons,
    improvementHistory: improvementHistory.slice(-80),
  };
}

/** Short principles for the LLM — never dump full playbook JSON. */
export function formatPlaybookForPrompt(raw: unknown, maxChars = 500): string {
  const pb = normalizePlaybook(raw);
  const lines: string[] = [];
  for (const t of (pb.tips || []).slice(-8)) {
    // Opening script tips are applied to the greeting — don't re-inject mid-call
    if (isOpeningStyleTip(t.note)) continue;
    lines.push(`- ${t.note}`);
  }
  for (const l of (pb.autoLessons || []).slice(-6)) {
    lines.push(`- (${l.outcome}) ${l.lesson}`);
  }
  if (!lines.length) return '';
  return `Learned tips (apply as principles, never recite verbatim):\n${lines.join('\n')}`.slice(
    0,
    maxChars,
  );
}

/** Latest approved tip that describes how to start the call. */
export function latestOpeningStyleTip(raw: unknown): string | null {
  const pb = normalizePlaybook(raw);
  const tips = [...(pb.tips || [])].reverse();
  for (const tip of tips) {
    if (isOpeningStyleTip(tip.note)) return tip.note;
  }
  return null;
}

/**
 * Rule-based lesson from call outcome + transcript signals.
 * Kept short so the agent improves without copying sample scripts.
 */
export function deriveAutoLesson(input: {
  outcome?: string | null;
  transcript?: string | null;
  interestScore?: number | null;
}): string | null {
  const outcome = String(input.outcome || '').toUpperCase();
  const raw = input.transcript || '';
  const t = raw.toLowerCase();
  const score = input.interestScore;
  const leadSaid = raw
    .split('\n')
    .filter((l) => /^lead:/i.test(l.trim()))
    .map((l) => l.replace(/^lead:\s*/i, ''))
    .join(' ')
    .toLowerCase();
  const agentSaid = raw
    .split('\n')
    .filter((l) => /^agent:/i.test(l.trim()))
    .map((l) => l.replace(/^agent:\s*/i, ''))
    .join(' ')
    .toLowerCase();

  // Busy / call-later ignored → strongest sales lesson
  if (
    /baad\s*me(?:in)?|call\s*later|callback|abhi\s*(?:nahi|nhi).*(?:kar|kr)|busy/i.test(
      leadSaid,
    ) &&
    /ghar\s*\/\s*flat dekhna|configuration kaun|do bedroom|ask_planning|chaaloo hai kya/i.test(
      agentSaid,
    )
  ) {
    return 'If customer is busy or says call later, confirm a callback and stop — never restart discovery questions.';
  }

  if (
    /callback|callback_requested/i.test(outcome) ||
    /baad\s*me(?:in)?\s*call|call\s*later|abhi\s*(?:nahi|nhi)\s*(?:kar|kr)\s*sak/i.test(
      leadSaid,
    )
  ) {
    return 'When customer asks to call later, acknowledge once, note callback, and end politely.';
  }

  if (
    /not_interested|not interested/i.test(outcome) ||
    /नहीं देख|not looking|search नहीं|kuch nahi|nahi chahiye|nhi chahiye/i.test(
      leadSaid,
    )
  ) {
    return 'If customer is not looking, accept once, thank them briefly, and end — no pitch or budget ask.';
  }

  if (
    /site_visit|site visit/i.test(outcome) ||
    /visit|site|weekend|saturday|friday/.test(leadSaid)
  ) {
    return 'When visit interest appears, confirm a day and offer one short reminder call before that day — keep wording fresh.';
  }

  if (typeof score === 'number' && score >= 7) {
    return 'High interest: move to matching options from Knowledge then visit timing; avoid restarting discovery.';
  }

  if (typeof score === 'number' && score <= 3 && /agent:/i.test(t)) {
    return 'Low engagement: ask one softer discovery question, stay shorter, and do not stack questions.';
  }

  if (/budget|बजट/.test(leadSaid) && /budget/i.test(agentSaid)) {
    return 'Do not lead with budget; first confirm planning → configuration → possession, then options.';
  }

  if (/got it|noted|perfect/.test(agentSaid)) {
    return 'Avoid stock English acks like Got it / Noted / Perfect; vary soft Hindi acks.';
  }

  const turns = raw.split('\n').filter((l) => /^lead:/i.test(l.trim())).length;
  if (turns >= 2) {
    if (/configuration kaun|ghar \/ flat dekhna|do bedroom yaa teen/i.test(agentSaid)) {
      return 'Do not loop the same discovery questions; listen to the last answer and advance the flow.';
    }
    return 'Keep one question per turn; paraphrase every line — same flow, fresh words.';
  }

  return null;
}

