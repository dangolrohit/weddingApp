import React, { useState } from 'react';
import { Modal } from './Modal';
import { Key, Copy, Check, AlertTriangle } from 'lucide-react';

export const PasskeyModal = ({ isOpen, onClose, passkey, clientNames, isRegenerated = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (passkey) {
      navigator.clipboard.writeText(passkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRegenerated ? "Passkey Regenerated" : "Client Passkey Generated"}
      maxWidth="max-w-md"
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
          <Key className="w-6 h-6" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {clientNames || 'Client Gallery Access'}
          </p>
          <p className="text-sm text-stone-600 mt-1">
            Share this passkey with the couple. They will use it together with their names to access their gallery preview and download link.
          </p>
        </div>

        {/* Passkey Display Box */}
        <div className="bg-stone-900 rounded-xl p-5 border border-stone-800 shadow-inner flex flex-col items-center justify-center gap-2">
          <span className="text-xs uppercase tracking-widest text-stone-400 font-mono">
            Access Passkey
          </span>
          <span className="text-3xl font-mono font-bold tracking-widest text-amber-400 select-all">
            {passkey}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer bg-stone-900 text-stone-100 hover:bg-stone-800 active:scale-[0.99]"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-stone-400" />
              <span>Copy Passkey</span>
            </>
          )}
        </button>

        {/* Security Alert */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-left text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <span>
            This passkey is shown only once and stored strictly as a cryptographic hash. If lost, you can regenerate a new passkey from the client detail page.
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
        >
          Done & Close
        </button>
      </div>
    </Modal>
  );
};
