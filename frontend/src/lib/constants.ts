export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CALLBACK_REQUESTED: 'Callback Requested',
  SITE_VISIT_INTERESTED: 'Site Visit Interested',
  NEGOTIATION: 'Negotiation',
  CONVERTED: 'Converted',
  NOT_INTERESTED: 'Not Interested',
  LOST: 'Lost',
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social Media',
  COLD_CALL: 'Cold Call',
  WALK_IN: 'Walk-in',
  OTHER: 'Other',
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartment',
  VILLA: 'Villa',
  PLOT: 'Plot',
  COMMERCIAL: 'Commercial',
  PENTHOUSE: 'Penthouse',
};

export const CALL_OUTCOME_LABELS: Record<string, string> = {
  CONNECTED: 'Connected',
  NO_ANSWER: 'No Answer',
  VOICEMAIL: 'Voicemail',
  CALLBACK_REQUESTED: 'Callback Requested',
  QUALIFIED: 'Qualified',
  NOT_INTERESTED: 'Not Interested',
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  CONTACTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  QUALIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CALLBACK_REQUESTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  SITE_VISIT_INTERESTED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  NEGOTIATION: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  CONVERTED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  NOT_INTERESTED: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  LOST: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  SCHEDULED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  NO_SHOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/leads', label: 'Leads', icon: 'Users' },
  { href: '/projects', label: 'Projects', icon: 'Building2' },
  { href: '/knowledge', label: 'Knowledge Base', icon: 'BookOpen' },
  { href: '/campaigns', label: 'Campaigns', icon: 'PhoneCall' },
  { href: '/calls', label: 'Call Logs', icon: 'Phone' },
  { href: '/feedback', label: 'AI Learning', icon: 'MessageSquare' },
  { href: '/appointments', label: 'Appointments', icon: 'Calendar' },
  { href: '/ai-settings', label: 'AI Agent', icon: 'Bot' },
  { href: '/analytics', label: 'Analytics', icon: 'BarChart3' },
] as const;

export const VOICE_OPTIONS = [
  { value: 'custom', label: 'Custom (zmh5xhBvMzqR4ZlXgcgL)' },
  { value: 'kellan', label: 'Kellan – Casual Friendly Speaker' },
  { value: 'darian', label: 'Darian – Warm Grounded Storyteller' },
  { value: 'elara', label: 'Elara – Crisp Pro Narrator' },
  { value: 'talia', label: 'Talia – Warm Soft Guide' },
  { value: 'alicia', label: 'Alicia – Polished Global Anchor' },
];

export const LANGUAGE_OPTIONS = [
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'gu-IN', label: 'Gujarati' },
];

export const TONE_OPTIONS = [
  {
    value: 'professional',
    label: 'Professional',
    description: 'Clear, polite, and business-like',
  },
    {
      value: 'friendly',
      label: 'Friendly',
      description: 'Warm, happy, lightly excited — like a helpful friend',
    },
  {
    value: 'persuasive',
    label: 'Persuasive',
    description: 'Confident, benefit-focused, and sales-oriented',
  },
  {
    value: 'warm',
    label: 'Warm & Empathetic',
    description: 'Caring, patient, and reassuring',
  },
  {
    value: 'formal',
    label: 'Formal',
    description: 'Respectful, structured, and traditional',
  },
];

export const CHATGPT_MODEL_OPTIONS = [
  {
    value: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'Recommended for live calls (replaces 2.5 Flash-Lite)',
  },
  {
    value: 'gemini-flash-lite-latest',
    label: 'Gemini Flash-Lite (Latest)',
    description: 'Best free-tier model for live calls',
  },
  {
    value: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    description: 'Light & fast',
  },
  {
    value: 'gemini-flash-latest',
    label: 'Gemini Flash (Latest)',
    description: 'Stronger Flash alias',
  },
  {
    value: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    description: 'Newer Flash generation',
  },
  {
    value: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: 'Newest Flash',
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Higher quality (tighter free limits)',
  },
];

/** @deprecated alias — UI still imports this name */
export const LLM_MODEL_OPTIONS = CHATGPT_MODEL_OPTIONS;

export const WORKING_DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];
