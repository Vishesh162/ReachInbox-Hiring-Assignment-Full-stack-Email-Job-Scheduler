'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { X, Clock, Send, AlertCircle, ExternalLink, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface EmailDetailModalProps {
  job: EmailJob | null;
  onClose: () => void;
}

export default function EmailDetailModal({ job, onClose }: EmailDetailModalProps) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header matching Figma */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div>
            <span className="text-xs text-gray-400 font-mono">Job ID: {job.id}</span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">{job.subject}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender & Recipient metadata */}
        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-12">From:</span>
              <span className="font-medium text-gray-800">
                {job.sender?.email || 'reachinbox.sender@ethereal.email'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-12">To:</span>
              <span className="font-semibold text-gray-900">{job.recipientEmail}</span>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="text-gray-400">
              Scheduled: {format(new Date(job.scheduledFor), 'MMM d, h:mm a')}
            </div>
            {job.sentAt && (
              <div className="text-green-700 font-medium">
                Sent: {format(new Date(job.sentAt), 'MMM d, h:mm a')}
              </div>
            )}
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {job.body}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">
              BullMQ: <span className="text-gray-700 font-semibold">{job.bullJobId}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://ethereal.email/messages"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#00A343] hover:underline font-medium"
            >
              <span>View Ethereal Mailbox</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
