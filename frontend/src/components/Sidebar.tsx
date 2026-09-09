'use client';

import React from 'react';
import { User, EmailStats } from '@/types';
import { Clock, Send, Plus, ExternalLink, Slack, LogOut, CheckCircle2, X } from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  stats: EmailStats | null;
  onLogout: () => void;
  onConnectSlack: () => void;
  onDisconnectSlack?: () => void;
}

function UserAvatar({ user, size = 'md' }: { user: User | null; size?: 'sm' | 'md' }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || 'User'}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClasses} rounded-full object-cover border border-gray-200 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-[#00A343] text-white font-semibold flex items-center justify-center border border-emerald-600/20 shrink-0 shadow-2xs select-none`}
    >
      {initial}
    </div>
  );
}

export default function Sidebar({
  user,
  activeTab,
  onTabChange,
  onOpenCompose,
  stats,
  onLogout,
  onConnectSlack,
  onDisconnectSlack,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between h-screen sticky top-0 select-none">
      {/* Top section: Logo, Profile, Compose CTA, Nav links */}
      <div>
        {/* Brand Logo */}
        <div className="p-5 flex items-center gap-2 border-b border-gray-100">
          <div className="w-7 h-7 bg-[#00A343] rounded flex items-center justify-center text-white font-bold text-sm shadow-sm">
            OX
          </div>
          <span className="font-bold text-gray-900 tracking-tight text-base">
            ReachInbox
          </span>
        </div>

        {/* User Profile Card */}
        <div className="p-3 mx-3 my-3 bg-white rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <UserAvatar user={user} />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold text-gray-900 truncate">
                {user?.name || 'Workspace User'}
              </h2>
              <p className="text-[11px] text-gray-500 truncate">
                {user?.email || 'user@reachinbox.ai'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compose Button */}
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={onOpenCompose}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-50 text-[#00A343] border border-[#00A343] rounded-full text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-[#00A343]" />
            <span>Compose</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="px-3 space-y-1">
          <button
            type="button"
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-[#00A343]' : 'text-gray-400'}`} />
              <span>Scheduled</span>
            </div>
            {stats !== null && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {stats.scheduled}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'sent'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-[#00A343]' : 'text-gray-400'}`} />
              <span>Sent</span>
            </div>
            {stats !== null && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200">
                {stats.sent}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Bottom section: Slack status, Live Queue Dashboard, Logout */}
      <div className="p-3 border-t border-gray-200 space-y-2">
        {/* Slack Connection Pill */}
        {user?.hasSlack ? (
          <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Slack Connected</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {onDisconnectSlack && (
                <button
                  type="button"
                  onClick={onDisconnectSlack}
                  title="Disconnect Slack workspace"
                  className="ml-1 text-emerald-700 hover:text-red-600 hover:bg-emerald-100/80 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectSlack}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
          >
            <Slack className="w-3.5 h-3.5 text-purple-600" />
            <span>Connect Slack</span>
          </button>
        )}

        {/* Live BullMQ Queue Dashboard Link */}
        <a
          href="https://reachinbox-scheduler-api-19at.onrender.com/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00A343]"></span>
            <span>BullMQ Queues</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
        </a>
      </div>
    </aside>
  );
}
