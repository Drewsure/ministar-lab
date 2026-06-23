'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// PWA Install Prompt — shows "Install App" banner when criteria are met
// ============================================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };
    checkStandalone();

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (isStandalone || dismissed || !installEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
        borderRadius: '20px',
        padding: '16px',
        boxShadow: '0 20px 60px -10px rgba(124, 58, 237, 0.5)',
        color: '#fff',
      }}>
      <div className="flex items-start gap-3">
        <div className="text-3xl">📱</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">Install MiniStar Lab</div>
          <div className="text-xs opacity-90 mb-2">Add to your home screen for the full app experience</div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await installEvent.prompt();
                const choice = await installEvent.userChoice;
                if (choice.outcome === 'accepted') {
                  setInstallEvent(null);
                }
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{ background: '#fff', color: '#7c3aed' }}>
              Install
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
