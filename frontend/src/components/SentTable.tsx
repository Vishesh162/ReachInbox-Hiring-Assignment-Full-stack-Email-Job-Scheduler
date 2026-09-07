'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
  onSelectJob?: (job: EmailJob) => void;
}

export default function SentTable({
  jobs,
  loading,
  onRefresh,
  onSelectJob,
}: SentTableProps) {
  if (loading && jobs.length === 0) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-4 py-3 border-b border-gray-100">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="w-48 h-4 bg-gray-200 rounded"></div>
            <div className="w-20 h-5 bg-green-100 rounded-full"></div>
            <div className="flex-1 h-4 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
        <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-3">
          <Send className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No sent emails yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-1 mb-4">
          Emails dispatched by the BullMQ worker will be archived and viewable here.
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
        const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.createdAt);
        const isSuccess = job.status === 'sent';

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

            {/* Status Badge */}
            <div className="shrink-0">
              {isSuccess ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#008A38] border border-[#A7F3D0]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sent</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-3 h-3" />
                  <span>Failed</span>
                </span>
              )}
            </div>

            {/* Subject and Body snippet */}
            <div className="flex-1 min-w-0 truncate text-gray-600">
              <span className="font-semibold text-gray-900">{job.subject}</span>
              <span className="text-gray-400 mx-2">—</span>
              <span className="text-gray-500">{job.body}</span>
            </div>

            {/* Sent Timestamp */}
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {format(sentDate, 'MMM d, h:mm a')}
            </div>

            {/* Ethereal Inbox Link */}
            <a
              href="https://ethereal.email/messages"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-[#00A343] hover:underline whitespace-nowrap"
            >
              <span>Ethereal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        );
      })}
    </div>
  );
}
