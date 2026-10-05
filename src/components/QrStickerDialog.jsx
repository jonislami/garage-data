import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Copy, Download, Phone, Globe, MapPin, Loader2 } from 'lucide-react';
import { useToast } from './ui';
import { vehicleName } from '../lib/vehicle';
import { vehicleQrUrl } from '../lib/maintenance';
import { fileName } from '../lib/print';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Word-wrap text on a canvas, centred; returns the y below the last line
function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, y);
      y += lineHeight;
      line = w;
    } else line = test;
  }
  if (line) { ctx.fillText(line, cx, y); y += lineHeight; }
  return y;
}

// The permanent QR sticker of a vehicle. The link never changes, so it is printed once.
export default function QrStickerDialog({ car, workshop, al, onClose }) {
  const toast = useToast();
  const [src, setSrc] = useState('');
  const [downloading, setDownloading] = useState(false);
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
  const shop = workshop || {};
  const contacts = [shop.phone, shop.website, shop.address].filter(Boolean);

  function stickerHtml() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName(car.clients?.full_name, 'QR', car.plate) || 'QR')}</title>
      <style>
        @page { size: 70mm 100mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111; }
        .s { width: 70mm; height: 100mm; padding: 4mm 4mm 3mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .logo { max-width: 34mm; max-height: 13mm; object-fit: contain; }
        .g { font-weight: 700; font-size: 11pt; margin-top: 1mm; line-height: 1.15; }
        .qr { width: 42mm; height: 42mm; margin: 2mm 0 1mm; }
        .c { font-size: 7.5pt; color: #444; }
        .v { font-size: 9pt; font-weight: 600; margin-top: 0.8mm; }
        .info { margin-top: auto; width: 100%; border-top: 0.3mm solid #ccc; padding-top: 1.5mm; font-size: 7.5pt; line-height: 1.35; color: #222; }
        .info div { overflow-wrap: anywhere; }
      </style></head><body><div class="s">
        ${shop.logo_url ? `<img class="logo" src="${escapeHtml(shop.logo_url)}" alt="">` : ''}
        ${shop.name ? `<div class="g">${escapeHtml(shop.name)}</div>` : ''}
        <img class="qr" src="${src}" alt="">
        <div class="c">${escapeHtml(caption)}</div>
        <div class="v">${escapeHtml(title)}</div>
        ${contacts.length ? `<div class="info">
          ${shop.phone ? `<div>☎ ${escapeHtml(shop.phone)}</div>` : ''}
          ${shop.website ? `<div>🌐 ${escapeHtml(shop.website)}</div>` : ''}
          ${shop.address ? `<div>📍 ${escapeHtml(shop.address)}</div>` : ''}
        </div>` : ''}
      </div></body></html>`;
  }

  // Print through a hidden frame (no pop-up window), once the logo and QR have loaded
  function print() {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open(); doc.write(stickerHtml()); doc.close();
    const images = [...doc.images].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    // Some browsers name the PDF after the main page title, so set it too while printing
    const previousTitle = document.title;
    document.title = doc.title;
    Promise.all(images).then(() => setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => { frame.remove(); document.title = previousTitle; }, 1000);
    }, 150));
  }

  // Full sticker as a PNG (700×1000 px = 70×100 mm at 10 px/mm)
  async function downloadPng() {
    setDownloading(true);
    try {
      const W = 700, H = 1000, cx = W / 2;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const font = (w, px) => `${w} ${px}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
      let y = 40;

      const [logo, qr] = await Promise.all([loadImage(shop.logo_url), loadImage(src)]);
      if (logo) {
        const scale = Math.min(340 / logo.width, 130 / logo.height, 1);
        const lw = logo.width * scale, lh = logo.height * scale;
        try {
          ctx.drawImage(logo, cx - lw / 2, y, lw, lh);
          y += lh + 12;
        } catch { /* image not drawable */ }
      }
      if (shop.name) { ctx.font = font(700, 38); y = wrapText(ctx, shop.name, cx, y, 620, 44); }
      y += 10;
      if (qr) ctx.drawImage(qr, cx - 210, y, 420, 420);
      y += 432;
      ctx.fillStyle = '#444'; ctx.font = font(400, 26); ctx.fillText(caption, cx, y); y += 36;
      ctx.fillStyle = '#111'; ctx.font = font(600, 30); y = wrapText(ctx, title, cx, y, 620, 36);

      if (contacts.length) {
        const lines = [shop.phone && `☎ ${shop.phone}`, shop.website && `🌐 ${shop.website}`, shop.address && `📍 ${shop.address}`].filter(Boolean);
        ctx.font = font(400, 26);
        // Measure first so the contact block sits at the bottom
        let blockH = 0;
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = ctx.font;
        for (const l of lines) {
          let n = 1, line = '';
          for (const w of l.split(/\s+/)) {
            const test = line ? `${line} ${w}` : w;
            if (measure.measureText(test).width > 620 && line) { n++; line = w; } else line = test;
          }
          blockH += n * 34;
        }
        let cy = Math.max(y + 24, H - 30 - blockH);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(40, cy - 14); ctx.lineTo(W - 40, cy - 14); ctx.stroke();
        ctx.fillStyle = '#222';
        for (const l of lines) cy = wrapText(ctx, l, cx, cy, 620, 34);
      }

      let href;
      try { href = canvas.toDataURL('image/png'); }
      catch { href = src; toast.info(al ? 'Logoja nuk u përfshi në PNG; u shkarkua vetëm QR kodi.' : 'The logo could not be included; only the QR code was downloaded.'); }
      const a = document.createElement('a');
      a.href = href;
      a.download = `${fileName(car.clients?.full_name, 'QR', car.plate || car.id)}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success(al ? 'Linku u kopjua.' : 'Link copied.'); }
    catch { toast.error(url); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div className="card w-full max-w-sm max-h-full overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-header">
          <h2 className="card-title">{al ? 'QR kodi i veturës' : 'Vehicle QR code'}</h2>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-5">
          {/* Sticker preview */}
          <div className="mx-auto w-64 rounded-md border border-gray-300 bg-white p-4 flex flex-col items-center text-center shadow-sm">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-12 max-w-[9rem] object-contain" />}
            {shop.name && <p className="mt-1 font-semibold text-gray-900 leading-tight">{shop.name}</p>}
            {src ? <img src={src} alt="QR" className="my-2 h-40 w-40" /> : <div className="skeleton my-2 h-40 w-40" />}
            <p className="text-[11px] text-gray-500">{caption}</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{title}</p>
            {contacts.length > 0 && (
              <div className="mt-2 w-full border-t border-gray-200 pt-2 space-y-0.5 text-[11px] text-gray-700">
                {shop.phone && <p className="flex items-center justify-center gap-1"><Phone size={11} />{shop.phone}</p>}
                {shop.website && <p className="flex items-center justify-center gap-1 break-all"><Globe size={11} />{shop.website}</p>}
                {shop.address && <p className="flex items-center justify-center gap-1"><MapPin size={11} />{shop.address}</p>}
              </div>
            )}
          </div>
          {contacts.length < 3 && (
            <p className="mt-3 text-xs text-amber-700 text-center">
              {al ? 'Plotësoni telefonin, uebfaqen dhe adresën te Cilësimet që të dalin në stiker.' : 'Fill in phone, website and address in Settings to show them on the sticker.'}
            </p>
          )}
          <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 text-center">
            {al
              ? 'Ky QR kod është i përhershëm për këtë veturë. Printojeni vetëm një herë — çdo servis i ri shfaqet automatikisht.'
              : 'This QR code is permanent for this vehicle. Print it once — every new service appears automatically.'}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={copy} className="btn btn-secondary"><Copy size={16} /> {al ? 'Kopjo linkun' : 'Copy link'}</button>
          <button type="button" onClick={downloadPng} disabled={!src || downloading} className="btn btn-secondary">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PNG
          </button>
          <button type="button" onClick={print} disabled={!src} className="btn btn-primary"><Printer size={16} /> {al ? 'Printo stikerin' : 'Print sticker'}</button>
        </div>
      </div>
    </div>
  );
}
