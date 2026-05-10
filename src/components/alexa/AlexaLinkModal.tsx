import { useCallback, useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Mic, Unlink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAlexaStore } from '@/stores/alexaStore';

interface AlexaLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export function AlexaLinkModal({ open, onClose }: AlexaLinkModalProps) {
  const link = useAlexaStore((s) => s.link);
  const pendingCode = useAlexaStore((s) => s.pendingCode);
  const pendingExpiresAt = useAlexaStore((s) => s.pendingExpiresAt);
  const fetchLink = useAlexaStore((s) => s.fetchLink);
  const issueCode = useAlexaStore((s) => s.issueCode);
  const unlink = useAlexaStore((s) => s.unlink);

  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) fetchLink();
  }, [open, fetchLink]);

  const handleIssue = useCallback(() => {
    setCopied(false);
    startTransition(() => {
      void issueCode();
    });
  }, [issueCode]);

  const handleUnlink = useCallback(() => {
    if (!window.confirm('Disconnect Alexa? You will need a new code to relink.'))
      return;
    startTransition(() => {
      void unlink();
    });
  }, [unlink]);

  const handleCopy = useCallback(() => {
    if (!pendingCode) return;
    void navigator.clipboard.writeText(pendingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [pendingCode]);

  return (
    <Modal open={open} onClose={onClose} title="Connect Alexa">
      <div className="flex flex-col gap-5">
        {link ? (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-sm text-retro-green">
              <span className="text-glow-cyan">▸</span> Alexa is linked.
            </p>
            <p className="font-mono text-xs text-retro-muted">
              // Try saying: <span className="text-retro-text">"Alexa, ask oh my buying to add eggs to my groceries list."</span>
            </p>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Unlink size={14} />}
                onClick={handleUnlink}
                loading={isPending}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-2 font-mono text-xs text-retro-muted list-decimal pl-5">
              <li>Tap <span className="text-retro-text">Generate code</span> below.</li>
              <li>Open the Alexa app, enable the <span className="text-retro-text">ohMyBuying</span> skill.</li>
              <li>Say: <span className="text-retro-cyan">"Alexa, ask oh my buying to link with code [CODE]"</span></li>
            </ol>

            <AnimatePresence mode="wait">
              {pendingCode ? (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-col gap-2 p-4 panel border-glow-cyan items-center"
                >
                  <span className="label-terminal">Your code</span>
                  <span className="font-display text-4xl tracking-[0.5em] text-retro-cyan text-glow-cyan">
                    {pendingCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-retro-muted hover:text-retro-cyan transition-colors mt-2"
                  >
                    <Copy size={12} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  {pendingExpiresAt ? (
                    <p className="font-mono text-[10px] text-retro-muted">
                      // expires {new Date(pendingExpiresAt).toLocaleTimeString()}
                    </p>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex justify-end">
              <Button
                onClick={handleIssue}
                loading={isPending}
                iconLeft={<Mic size={14} />}
              >
                {pendingCode ? 'Generate new code' : 'Generate code'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
