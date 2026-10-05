import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { canPromptInstall, isIOS, isStandalone, promptInstall, subscribeInstall } from '../lib/install';

// "Download the app" button. Chrome/Edge (computer + Android): opens the install dialog.
// iPhone: explains Safari → Share → Add to Home Screen. Hidden once the app is installed.
export default function InstallApp({ al, className = 'btn btn-secondary', label }) {
  const [, force] = useState(0);
  const [showIosHelp, setShowIosHelp] = useState(false);
  useEffect(() => subscribeInstall(() => force(n => n + 1)), []);

  if (isStandalone()) return null;
  const ios = isIOS();
  if (!ios && !canPromptInstall()) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => (ios ? setShowIosHelp(true) : promptInstall())}>
        <Download size={16} /> {label || (al ? 'Shkarko aplikacionin' : 'Install the app')}
      </button>
      {showIosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setShowIosHelp(false)}>
          <div className="card w-full max-w-sm p-5 text-gray-900" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img src="/icons/apple-touch-icon.png" alt="" className="h-10 w-10 rounded-lg border border-gray-200" />
                <p className="font-semibold">{al ? 'Shkarko GarageData në iPhone' : 'Install GarageData on iPhone'}</p>
              </div>
              <button type="button" onClick={() => setShowIosHelp(false)} className="btn-icon" aria-label="Close"><X size={16} /></button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">1</span>
                <span>{al ? 'Hapeni këtë faqe në' : 'Open this page in'} <b>Safari</b></span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">2</span>
                <span className="flex items-center gap-1.5">{al ? 'Prekni' : 'Tap'} <Share size={16} className="text-blue-600" /> <b>{al ? 'Ndaj (Share)' : 'Share'}</b></span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">3</span>
                <span className="flex items-center gap-1.5">{al ? 'Zgjidhni' : 'Choose'} <PlusSquare size={16} /> <b>{al ? 'Shto në ekranin kryesor' : 'Add to Home Screen'}</b></span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-gray-500">{al ? 'Ikona e GarageData shfaqet në ekran dhe hapet si aplikacion.' : 'The GarageData icon appears on your home screen and opens like an app.'}</p>
          </div>
        </div>
      )}
    </>
  );
}
