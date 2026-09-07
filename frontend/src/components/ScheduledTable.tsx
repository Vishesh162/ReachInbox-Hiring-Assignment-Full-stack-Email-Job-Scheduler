'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { Clock, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ScheduledTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
  onSelectJob?: (job: EmailJob) => void;
}

export default function ScheduledTable({
  jobs,
  loading,
  onRefresh,
  onSelectJob,
}: ScheduledTableProps) {
  if (loading && jobs.length === 0) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-4 py-3 border-b border-gray-100">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="w-48 h-4 bg-gray-200 rounded"></div>
            <div className="w-24 h-5 bg-amber-100 rounded-full"></div>
            <div className="flex-1 h-4 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No scheduled emails</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-1 mb-4">
          All pending outreach campaigns have been dispatched or no jobs have been scheduled yet.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 overflow-x-auto">
      {jobs.map((job) => {
        const scheduledDate = new Date(job.scheduledFor);
        const isPast = scheduledDate.getTime() <= Date.now();
        const relativeTime = isPast
          ? 'due now'
          : `in ${formatDistanceToNow(scheduledDate)}`;

        return (
          <div
            key={job.id}
            onClick={() => onSelectJob?.(job)}
            className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group text-sm"
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Recipient */}
            <div className="w-44 truncate font-medium text-gray-900">
              {job.recipientEmail}
            </div>

            {/* Orange countdown badge matching Figma screenshot */}
            <div className="shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  job.status === 'rescheduled'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{relativeTime}</span>
              </span>
            </div>

            {/* Subject and Body snippet */}
            <div className="flex-1 min-w-0 truncate text-gray-600">
              <span className="font-semibold text-gray-900">{job.subject}</span>
              <span className="text-gray-400 mx-2">—</span>
              <span className="text-gray-500">{job.body}</span>
            </div>

            {/* Scheduled Date timestamp */}
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {format(scheduledDate, 'MMM d, h:mm a')}
            </div>

            {/* Rate limit status alert if rescheduled */}
            {job.status === 'rescheduled' && (
              <span
                title={job.error || 'Hourly sender rate limit hit; moved to next window'}
                className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                <span>Rescheduled</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
