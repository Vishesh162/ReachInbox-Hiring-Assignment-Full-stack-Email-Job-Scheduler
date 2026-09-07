export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  hasSlack: boolean;
  slackTeamId?: string | null;
  slackChannelId?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  host: string;
  port: number;
}

export interface EmailJob {
  id: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'rescheduled';
  attempts: number;
  sentAt?: string | null;
  error?: string | null;
  bullJobId: string;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
  };
  campaign?: {
    id: string;
    subject: string;
  };
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  totalLeads: number;
  createdAt: string;
  _count?: {
    emailJobs: number;
  };
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}
