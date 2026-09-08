'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { User, EmailJob, EmailStats, Sender } from '@/types';
import Sidebar from '@/components/Sidebar';
import ScheduledTable from '@/components/ScheduledTable';
import SentTable from '@/components/SentTable';
import ComposeModal from '@/components/ComposeModal';
import EmailDetailModal from '@/components/EmailDetailModal';
import { Search, RefreshCw, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

function UserAvatar({ user }: { user: User | null }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || 'User'}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-[#00A343] text-white font-semibold text-xs flex items-center justify-center border border-emerald-600/20 shrink-0 shadow-2xs select-none">
      {initial}
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [searchResults, setSearchResults] = useState<EmailJob[] | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check query params for Slack OAuth return
  useEffect(() => {
    const slackStatus = searchParams.get('slack');
    if (slackStatus === 'connected') {
      const team = searchParams.get('team');
      setBannerMessage({
        type: 'success',
        text: `Slack workspace ${team ? `(${team})` : ''} connected successfully! Rate-limit alerts are active.`,
      });
    } else if (slackStatus === 'error') {
      setBannerMessage({
        type: 'error',
        text: `Slack connection failed: ${searchParams.get('msg') || 'Unknown error'}`,
      });
    }
  }, [searchParams]);

  // Load User & Senders
  useEffect(() => {
    async function init() {
      try {
        const meRes = await api.getMe();
        setUser(meRes.user);
      } catch {
        router.push('/login');
        return;
      }

      try {
        const sendersRes = await api.getSenders();
        setSenders(sendersRes.senders || []);
      } catch (err) {
        console.warn('Could not load senders:', err);
      }
    }
    init();
  }, [router]);

  // Fetch emails and stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduledRes, sentRes, statsRes] = await Promise.all([
        api.getScheduledEmails(1, 50),
        api.getSentEmails(1, 50),
        api.getEmailStats(),
      ]);

      setScheduledJobs(scheduledRes.items || []);
      setSentJobs(sentRes.items || []);
      setStats(statsRes);
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for live status updates as BullMQ processes delayed jobs
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Search handler (Elasticsearch with fallback)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchEmails(searchQuery.trim());
        setSearchResults(res.items || []);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  const handleConnectSlack = async () => {
    try {
      const res = await api.getSlackAuthUrl();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: 'Slack OAuth requires SLACK_CLIENT_ID in your .env file. Add your Slack app credentials to enable live channel alerts.',
      });
    }
  };

  const displayedJobs = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled'
    ? scheduledJobs
    : sentJobs;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Sidebar matching Figma */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
          setSearchResults(null);
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
        stats={stats}
        onLogout={handleLogout}
        onConnectSlack={handleConnectSlack}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Slack Connection Banner if applicable */}
        {bannerMessage && (
          <div
            className={`px-6 py-2.5 flex items-center justify-between text-xs ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                : 'bg-red-50 text-red-800 border-b border-red-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="font-bold ml-4 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Bar with Search matching Figma */}
        <header className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 w-full max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-800 placeholder-gray-400 bg-gray-50 hover:bg-gray-100/80 focus:bg-white rounded-lg border border-transparent focus:border-gray-300 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchData}
              title="Refresh queue data"
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00A343]' : ''}`} />
            </button>

            <span className="text-xs text-gray-400 hidden md:inline">
              {searchResults !== null
                ? `Search results (${searchResults.length})`
                : activeTab === 'scheduled'
                ? `Scheduled (${scheduledJobs.length})`
                : `Sent (${sentJobs.length})`}
            </span>

            <div className="h-5 w-[1px] bg-gray-200"></div>

            {/* User Profile & Logout Button */}
            {user && (
              <div className="flex items-center gap-2.5">
                <UserAvatar user={user} />
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-gray-900 leading-tight truncate max-w-[120px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-tight truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out of ReachInbox"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Table */}
        <div className="flex-1 bg-white">
          {activeTab === 'scheduled' && searchResults === null ? (
            <ScheduledTable
              jobs={scheduledJobs}
              loading={loading}
              onRefresh={fetchData}
              onSelectJob={(job) => setSelectedJob(job)}
            />
          ) : activeTab === 'sent' && searchResults === null ? (
            <SentTable
              jobs={sentJobs}
              loading={loading}
              onRefresh={fetchData}
              onSelectJob={(job) => setSelectedJob(job)}
            />
          ) : (
            // Search Results Table
            <div className="divide-y divide-gray-100">
              <div className="px-6 py-2 bg-gray-50 text-xs font-semibold text-gray-500">
                Found {displayedJobs.length} matches via Elasticsearch index
              </div>
              <ScheduledTable
                jobs={displayedJobs}
                loading={false}
                onRefresh={fetchData}
                onSelectJob={(job) => setSelectedJob(job)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchData();
          setActiveTab('scheduled');
        }}
        senders={senders}
      />

      {/* Detail Modal */}
      <EmailDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A343]"></div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
