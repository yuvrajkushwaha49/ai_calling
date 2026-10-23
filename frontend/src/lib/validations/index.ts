import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export const leadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'COLD_CALL', 'WALK_IN', 'OTHER']),
  budget: z.coerce.number().positive().optional(),
  propertyType: z.enum(['APARTMENT', 'VILLA', 'PLOT', 'COMMERCIAL', 'PENTHOUSE']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CONVERTED', 'LOST']),
  notes: z.string().optional(),
  projectId: z.string().optional(),
});

export const projectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  companyName: z.string().optional(),
  location: z.string().min(2, 'Location is required'),
  builder: z.string().min(2, 'Builder name is required'),
  propertyType: z.enum(['APARTMENT', 'VILLA', 'PLOT', 'COMMERCIAL', 'PENTHOUSE']),
  startingPrice: z.coerce.number().positive('Starting price must be positive'),
  endingPrice: z.coerce.number().positive('Maximum price must be positive'),
  possessionDate: z.string().optional(),
  reraNumber: z.string().optional(),
  amenities: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

export const appointmentSchema = z.object({
  leadId: z.string().min(1, 'Lead is required'),
  projectId: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().optional(),
});

export const aiSettingsSchema = z.object({
  agentName: z.string().min(2, 'Agent name is required'),
  agentVoice: z.string().min(1, 'Voice selection is required'),
  language: z.enum(['en-IN', 'hi-IN', 'hinglish', 'mr-IN', 'gu-IN']),
  tone: z.enum(['professional', 'friendly', 'persuasive', 'warm', 'formal']),
  llmModel: z.enum([
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4.1-nano',
    'o4-mini',
  ]),
  systemPrompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
    days: z.array(z.string()),
  }),
  isActive: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type LeadFormData = z.infer<typeof leadSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type AiSettingsFormData = z.infer<typeof aiSettingsSchema>;
