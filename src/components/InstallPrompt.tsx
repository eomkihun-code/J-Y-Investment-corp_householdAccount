import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl bg-indigo-950 border border-indigo-700 shadow-xl p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">앱으로 설치하기</p>
        <p className="text-xs text-indigo-300 mt-0.5">홈 화면에 추가하면 더 편리하게 사용할 수 있어요</p>
      </div>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-medium text-white transition-colors"
      >
        <Download size={14} />
        설치
      </button>
      <button
        onClick={handleDismiss}
        className="rounded-lg p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-800 transition-colors"
        aria-label="닫기"
      >
        <X size={16} />
      </button>
    </div>
  );
}
