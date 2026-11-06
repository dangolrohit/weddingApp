import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { deliveryApi } from '../api/delivery';
import { 
  Send, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Clock, 
  ShieldAlert, 
  ExternalLink 
} from 'lucide-react';

export const SendLinkModal = ({ isOpen, onClose, client, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [revokePrevious, setRevokePrevious] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentResult, setSentResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (client) {
      setEmail(client.linked_email || '');
      setSaveEmail(!client.linked_email);
      setRevokePrevious(true);
      setError('');
      setSentResult(null);
      setCopied(false);
    }
  }, [client, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide a valid destination email address.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const data = await deliveryApi.adminSendLink(client.id, {
        email: email.trim(),
        save_email: saveEmail,
        revoke_previous: revokePrevious,
      });
      setSentResult(data);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to dispatch download link.');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = () => {
    if (sentResult?.download_url) {
      navigator.clipboard.writeText(sentResult.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!client) return null;

  const coupleTitle = `${client.groom_name} & ${client.bride_name}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send Gallery Link • ${coupleTitle}`}
      maxWidth="max-w-lg"
    >
      {sentResult ? (
        <div className="space-y-5 py-2">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Download Link Dispatched!</p>
              <p className="leading-relaxed">
                A 7-day multi-part ZIP download link was generated and emailed to{' '}
                <span className="font-medium font-mono text-emerald-950">{sentResult.link?.email}</span>.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Direct Link URL (for WhatsApp or SMS share)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sentResult.download_url}
                className="flex-1 px-3.5 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg text-stone-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Destination Email *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full pl-10 pr-4 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
            {client.linked_email && client.linked_email !== email && (
              <p className="text-[11px] text-amber-700 mt-1">
                Note: Client's currently registered email is <span className="font-mono">{client.linked_email}</span>.
              </p>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveEmail}
                onChange={(e) => setSaveEmail(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Save this email as the client's permanent linked address</span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={revokePrevious}
                onChange={(e) => setRevokePrevious(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Revoke any previous active download links (recommended for security)</span>
            </label>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-500 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Link Policy</span>
            </div>
            <p>
              Valid for 7 days • Maximum 10 downloads per ZIP part • Uncompressed fast streaming.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Link via Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
