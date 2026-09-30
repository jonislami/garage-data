import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Copy, Download } from 'lucide-react';
import { useToast } from './ui';
import { vehicleName } from '../lib/vehicle';
import { vehicleQrUrl } from '../lib/maintenance';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The permanent QR sticker of a vehicle. The link never changes, so it is printed once.
export default function QrStickerDialog({ car, workshop, al, onClose }) {
  const toast = useToast();
  const [src, setSrc] = useState('');
  const url = car.qr_token ? vehicleQrUrl(car.qr_token) : '';

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => toast.error(al ? 'QR kodi nuk u krijua.' : 'Could not create the QR code.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const title = `${vehicleName(car.make, car.model)}${car.plate ? ` · ${car.plate}` : ''}`;
  const caption = al ? 'Skanoni për historinë e servisit' : 'Scan for the service history';

  function print() {
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return toast.error(al ? 'Lejoni dritaret pop-up për të printuar.' : 'Allow pop-ups to print.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${escapeHtml(car.plate || '')}</title>
      <style>
        @page { size: 60mm 80mm; margin: 0; }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
        .s { width: 60mm; height: 80mm; box-sizing: border-box; padding: 4mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .g { font-weight: 700; font-size: 11pt; }
        img { width: 46mm; height: 46mm; margin: 2mm 0; }
        .c { font-size: 8pt; color: #444; }
        .v { font-size: 9pt; font-weight: 600; margin-top: 1mm; }
        .p { font-size: 8pt; color: #444; }
      </style></head><body><div class="s">
        <div class="g">${escapeHtml(workshop?.name || '')}</div>
        <img src="${src}" alt="">
        <div class="c">${escapeHtml(caption)}</div>
        <div class="v">${escapeHtml(title)}</div>
        ${workshop?.phone ? `<div class="p">${escapeHtml(workshop.phone)}</div>` : ''}
      </div><script>window.onload = () => { window.print(); };<\/script></body></html>`);
    w.document.close();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success(al ? 'Linku u kopjua.' : 'Link copied.'); }
    catch { toast.error(url); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div className="card w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-header">
          <h2 className="card-title">{al ? 'QR kodi i veturës' : 'Vehicle QR code'}</h2>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col items-center text-center">
          {workshop?.name && <p className="font-semibold text-gray-900">{workshop.name}</p>}
          {src ? <img src={src} alt="QR" className="my-3 h-52 w-52" /> : <div className="skeleton my-3 h-52 w-52" />}
          <p className="text-xs text-gray-500">{caption}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{title}</p>
          <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {al
              ? 'Ky QR kod është i përhershëm për këtë veturë. Printojeni vetëm një herë — çdo servis i ri shfaqet automatikisht.'
              : 'This QR code is permanent for this vehicle. Print it once — every new service appears automatically.'}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={copy} className="btn btn-secondary"><Copy size={16} /> {al ? 'Kopjo linkun' : 'Copy link'}</button>
          {src && (
            <a href={src} download={`QR-${(car.plate || car.id).replace(/\s+/g, '')}.png`} className="btn btn-secondary">
              <Download size={16} /> PNG
            </a>
          )}
          <button type="button" onClick={print} disabled={!src} className="btn btn-primary"><Printer size={16} /> {al ? 'Printo stikerin' : 'Print sticker'}</button>
        </div>
      </div>
    </div>
  );
}
