import { EmailJob, EmailStats, Sender, User } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Includes HTTP-only session cookies
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Auth
  async loginWithGoogle(idToken: string): Promise<{ success: boolean; user: User; token: string }> {
    return fetcher('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  async loginWithEmail(email: string): Promise<{ success: boolean; user: User; token: string }> {
    return fetcher('/api/auth/email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async getMe(): Promise<{ user: User }> {
    return fetcher('/api/auth/me');
  },

  async logout(): Promise<{ success: boolean }> {
    return fetcher('/api/auth/logout', { method: 'POST' });
  },

  // Senders
  async getSenders(): Promise<{ senders: Sender[] }> {
    return fetcher('/api/senders');
  },

  async createEtherealSender(): Promise<{ success: boolean; sender: Sender }> {
    return fetcher('/api/senders/ethereal', { method: 'POST' });
  },

  // Campaigns & CSV Parsing
  async createCampaign(data: {
    subject: string;
    body: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    senderIds: string[];
    recipients: string[];
  }): Promise<{ success: boolean; totalScheduled: number }> {
    return fetcher('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async parseCsvRecipients(csvContent: string): Promise<{
    success: boolean;
    totalCount: number;
    emails: string[];
  }> {
    return fetcher('/api/campaigns/parse-csv', {
      method: 'POST',
      body: JSON.stringify({ csvContent }),
    });
  },

  // Emails
  async getScheduledEmails(page = 1, limit = 20): Promise<{
    page: number;
    total: number;
    totalPages: number;
    items: EmailJob[];
  }> {
    return fetcher(`/api/emails/scheduled?page=${page}&limit=${limit}`);
  },

  async getSentEmails(page = 1, limit = 20): Promise<{
    page: number;
    total: number;
    totalPages: number;
    items: EmailJob[];
  }> {
    return fetcher(`/api/emails/sent?page=${page}&limit=${limit}`);
  },

  async getEmailStats(): Promise<EmailStats> {
    return fetcher('/api/emails/stats');
  },

  async searchEmails(q: string, status?: string): Promise<{
    total: number;
    items: EmailJob[];
    source: string;
  }> {
    const params = new URLSearchParams({ q });
    if (status) params.append('status', status);
    return fetcher(`/api/emails/search?${params.toString()}`);
  },

  // Slack
  async getSlackAuthUrl(): Promise<{ url: string }> {
    return fetcher('/api/slack/oauth/start');
  },

  async disconnectSlack(): Promise<{ success: boolean; message: string }> {
    return fetcher('/api/slack/disconnect', {
      method: 'POST',
    });
  },
};

