'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  Calendar,
  Clock,
  ChevronDown,
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Undo,
  Redo,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Sender } from '@/types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  senders: Sender[];
}

export default function ComposeModal({
  isOpen,
  onClose,
  onSuccess,
  senders,
}: ComposeModalProps) {
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([
    'oliver.lead1@domain.com',
    'jane.smith@host.com',
    'daniel.k@mail.com',
  ]);
  const [subject, setSubject] = useState<string>('');
  const [delaySec, setDelaySec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);
  const [body, setBody] = useState<string>('');

  // Rich Text Editor State
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    ul: false,
    ol: false,
  });

  const updateActiveStyles = () => {
    try {
      setActiveStyles({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // ignore
    }
  };

  // Selection & Media refs
  const savedSelectionRef = useRef<Range | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [showImageMenu, setShowImageMenu] = useState(false);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    updateActiveStyles();
  };

  const handleInsertLink = () => {
    saveSelection();
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';

    const url = window.prompt('Enter link URL (e.g. https://reachinbox.ai):', 'https://');
    if (!url || !url.trim() || url.trim() === 'https://') return;

    if (editorRef.current) {
      editorRef.current.focus();
    }
    restoreSelection();

    if (selectedText.trim()) {
      document.execCommand('createLink', false, url.trim());
    } else {
      const linkText = window.prompt('Enter link text:', url.trim()) || url.trim();
      const linkHtml = `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" style="color: #00A343; text-decoration: underline; font-weight: 500;">${linkText}</a>&nbsp;`;
      document.execCommand('insertHTML', false, linkHtml);
    }

    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    updateActiveStyles();
  };

  const handleInsertImageUrl = () => {
    saveSelection();
    const url = window.prompt('Enter image URL (e.g. https://images.unsplash.com/...):', 'https://');
    if (!url || !url.trim() || url.trim() === 'https://') return;

    if (editorRef.current) {
      editorRef.current.focus();
    }
    restoreSelection();

    const imgHtml = `<img src="${url.trim()}" alt="Inserted image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;" /><br/>`;
    document.execCommand('insertHTML', false, imgHtml);

    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    setShowImageMenu(false);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (editorRef.current) {
        editorRef.current.focus();
      }
      restoreSelection();

      const imgHtml = `<img src="${base64}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;" /><br/>`;
      document.execCommand('insertHTML', false, imgHtml);

      if (editorRef.current) {
        setBody(editorRef.current.innerHTML);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
    setShowImageMenu(false);
  };

  // Send Later popover state
  const [showSendLater, setShowSendLater] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      setSelectedSenderId(senders[0].id);
    }
  }, [senders, selectedSenderId]);

  if (!isOpen) return null;

  // Add recipient from text input
  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = recipientInput.trim().replace(/,$/, '');
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        if (!recipients.includes(val)) {
          setRecipients([...recipients, val]);
        }
        setRecipientInput('');
      }
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  // CSV File upload & parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = await api.parseCsvRecipients(text);
      if (parsed.emails && parsed.emails.length > 0) {
        const merged = Array.from(new Set([...recipients, ...parsed.emails]));
        setRecipients(merged);
      }
    } catch (err: any) {
      setError(`Failed to parse CSV: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Schedule Quick Options
  const setQuickSchedule = (hoursAhead: number) => {
    const target = new Date();
    target.setHours(target.getHours() + hoursAhead);
    setScheduledTime(target.toISOString().slice(0, 16));
  };

  const handleSubmit = async (isDelayed: boolean) => {
    if (recipients.length === 0) {
      setError('Please provide at least one recipient email.');
      return;
    }
    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    const plainBody = body.replace(/<[^>]+>/g, '').trim();
    if (!plainBody && !body.includes('<img') && !body.trim()) {
      setError('Please provide the email body content.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = isDelayed && scheduledTime
        ? new Date(scheduledTime).toISOString()
        : new Date(Date.now() + 1000).toISOString();

      await api.createCampaign({
        subject,
        body,
        startTime,
        delayMs: delaySec * 1000,
        hourlyLimit,
        senderIds: selectedSenderId ? [selectedSenderId] : [],
        recipients,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Header Bar matching Figma */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>

          {/* Top Actions: Send Later button + Direct Send */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSendLater(!showSendLater)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#00A343] border border-[#00A343] rounded-full hover:bg-green-50 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Send Later</span>
              </button>

              {/* Send Later Popover matching Figma Image 2 */}
              {showSendLater && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Send Later
                  </h4>

                  {/* Date & Time Picker */}
                  <div className="relative mb-3">
                    <input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-gray-700"
                    />
                  </div>

                  {/* Quick Select Preset Options */}
                  <div className="space-y-1 mb-4">
                    <button
                      type="button"
                      onClick={() => setQuickSchedule(24)}
                      className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSchedule(12)}
                      className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
                    >
                      Tomorrow, 10:30 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSchedule(15)}
                      className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
                    >
                      Tomorrow, 1:00 PM
                    </button>
                  </div>

                  {/* Bottom Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowSendLater(false)}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendLater(false);
                        handleSubmit(true);
                      }}
                      className="px-3 py-1 text-xs font-semibold text-[#00A343] border border-[#00A343] rounded-full hover:bg-green-50"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="px-4 py-1.5 bg-[#00A343] hover:bg-[#008A38] text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
            >
              {loading ? 'Scheduling...' : 'Send Now'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-6 py-2.5 text-xs border-b border-red-100 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Form Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* From field */}
          <div className="flex items-center gap-4 text-sm pb-2 border-b border-gray-100">
            <span className="text-gray-400 w-16">From:</span>
            <div className="relative inline-block">
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="appearance-none bg-gray-100/70 hover:bg-gray-100 text-gray-800 text-xs font-medium py-1 px-3 pr-8 rounded-full border-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* To field with chips & Upload List button matching Figma */}
          <div className="flex items-start gap-4 text-sm pb-2 border-b border-gray-100">
            <span className="text-gray-400 w-16 pt-1">To:</span>
            <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[32px]">
              {recipients.slice(0, 5).map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#008A38] border border-[#A7F3D0]"
                >
                  <span>{r}</span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(i)}
                    className="hover:text-red-600 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              {recipients.length > 5 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  +{recipients.length - 5}
                </span>
              )}

              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleAddRecipient}
                placeholder={recipients.length === 0 ? 'Type email and press Enter...' : 'Add more...'}
                className="text-xs text-gray-800 placeholder-gray-400 focus:outline-none flex-1 min-w-[120px] py-1 border-none"
              />
            </div>

            {/* Upload List CSV Button matching Figma */}
            <div className="shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-[#00A343] hover:text-[#008A38] font-medium py-1 px-2 rounded hover:bg-green-50/50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload List</span>
              </button>
            </div>
          </div>

          {/* Subject Field */}
          <div className="flex items-center gap-4 text-sm pb-2 border-b border-gray-100">
            <span className="text-gray-400 w-16">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none py-1 border-none"
            />
          </div>

          {/* Config numerical inputs: Delay and Hourly Limit matching Figma */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-600 pt-1">
            <div className="flex items-center gap-2">
              <span>Delay between 2 emails (sec):</span>
              <input
                type="number"
                min="0"
                value={delaySec}
                onChange={(e) => setDelaySec(Math.max(0, Number(e.target.value)))}
                className="w-16 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span>Hourly Limit:</span>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {scheduledTime && (
              <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">
                <Calendar className="w-3.5 h-3.5" />
                <span>Scheduled for: {new Date(scheduledTime).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Rich text formatting toolbar matching Figma Screenshot 2 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mt-4 bg-white">
            <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center gap-1 sm:gap-1.5 text-gray-600 select-none">
              <button
                type="button"
                title="Undo (Ctrl+Z)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('undo')}
                className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Redo (Ctrl+Y)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('redo')}
                className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                title="Bold (Ctrl+B)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('bold')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.bold ? 'bg-gray-200 text-gray-900 font-bold shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Italic (Ctrl+I)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('italic')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.italic ? 'bg-gray-200 text-gray-900 italic shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Underline (Ctrl+U)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('underline')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.underline ? 'bg-gray-200 text-gray-900 underline shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Strikethrough"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('strikeThrough')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.strikethrough ? 'bg-gray-200 text-gray-900 line-through shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                title="Align Left"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('justifyLeft')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.alignLeft ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Align Center"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('justifyCenter')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.alignCenter ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Align Right"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('justifyRight')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.alignRight ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                title="Bullet List"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('insertUnorderedList')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.ul ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Numbered List"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => executeCommand('insertOrderedList')}
                className={`p-1.5 rounded transition-colors ${
                  activeStyles.ol ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                title="Insert Link"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={handleInsertLink}
                className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>

              {/* Image Menu Popover */}
              <div className="relative inline-block">
                <input
                  type="file"
                  ref={imageFileInputRef}
                  accept="image/*"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  title="Insert Image (Upload or URL)"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveSelection();
                  }}
                  onClick={() => setShowImageMenu(!showImageMenu)}
                  className={`p-1.5 rounded transition-colors ${
                    showImageMenu ? 'bg-gray-200 text-gray-900 shadow-2xs' : 'text-gray-600 hover:bg-gray-200/60'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>

                {showImageMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 text-xs text-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        imageFileInputRef.current?.click();
                        setShowImageMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-gray-500" />
                      <span>Upload from Device</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertImageUrl}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span>Insert from URL</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ContentEditable Rich Text Body matching Figma */}
            <div
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-multiline="true"
              data-placeholder="Type Your Reply..."
              onInput={(e) => {
                setBody(e.currentTarget.innerHTML);
                updateActiveStyles();
                saveSelection();
              }}
              onKeyUp={() => {
                updateActiveStyles();
                saveSelection();
              }}
              onMouseUp={() => {
                updateActiveStyles();
                saveSelection();
              }}
              onBlur={saveSelection}
              className="w-full min-h-[180px] max-h-[320px] p-4 text-sm text-gray-900 focus:outline-none overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#00A343] [&_a]:underline [&_a]:font-medium [&_img]:max-w-full [&_img]:rounded-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
