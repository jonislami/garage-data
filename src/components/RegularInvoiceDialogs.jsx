import { useState } from 'react';
import { X, Loader2, Trash2, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div className="card w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-header">
          <h2 className="card-title">{title}</h2>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// "2026-09" -> "092026"
const periodLabel = period => (period ? `${period.slice(5, 7)}${period.slice(0, 4)}` : '');
const formatNumber = (seq, period) => `${String(seq).padStart(2, '0')}/${periodLabel(period)}`;

// Change the NN part of a regular invoice number (the month always follows the invoice date)
export function ChangeNumberDialog({ invoice, al, isOnline, onClose, onChanged }) {
  const toast = useToast();
  const [seq, setSeq] = useState(String(invoice.regular_seq || ''));
  const [saving, setSaving] = useState(false);
  const n = parseInt(seq, 10);
  const valid = Number.isInteger(n) && n >= 1 && n <= 9999;

  async function save(e) {
    e.preventDefault();
    if (!isOnline) return toast.error(al ? 'Ndryshimi i numrit kërkon internet.' : 'Changing the number requires internet.');
    if (!valid) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('set_regular_invoice_number', { p_service_id: invoice.id, p_seq: n });
    setSaving(false);
    if (error) {
      const taken = /already used/i.test(error.message);
      return toast.error(taken
        ? (al ? `Numri ${formatNumber(n, invoice.regular_period)} është i zënë nga një faturë tjetër.` : `Number ${formatNumber(n, invoice.regular_period)} is already used by another invoice.`)
        : (al ? 'Gabim: ' : 'Error: ') + error.message);
    }
    toast.success(al ? `Numri u ndryshua në ${data}.` : `Number changed to ${data}.`);
    onChanged({ regular_seq: n, regular_number: data });
  }

  return (
    <Modal title={al ? 'Ndrysho numrin e faturës' : 'Change invoice number'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="p-4 md:p-5 space-y-3">
          <p className="text-sm text-gray-600">
            {al ? 'Numri aktual:' : 'Current number:'} <span className="font-code font-medium text-gray-900">{invoice.regular_number}</span>
          </p>
          <div>
            <label className="label">{al ? 'Numri i ri (NN)' : 'New number (NN)'}</label>
            <div className="flex items-center gap-2">
              <input autoFocus type="number" min="1" max="9999" className="input w-28 font-code" value={seq} onChange={e => setSeq(e.target.value)} />
              <span className="font-code text-gray-500">/{periodLabel(invoice.regular_period)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {al
              ? 'Muaji merret nga data e faturës. Numri nuk mund të jetë i njëjtë me një faturë tjetër të këtij muaji. Faturat e tjera nuk ndryshojnë.'
              : 'The month comes from the invoice date. The number cannot match another invoice of this month. Other invoices are not changed.'}
          </p>
        </div>
        <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
          <button type="submit" disabled={saving || !valid} className="btn btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Hash size={16} />}
            {valid ? `${al ? 'Ruaj' : 'Save'} ${formatNumber(n, invoice.regular_period)}` : (al ? 'Ruaj' : 'Save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Delete a numbered regular invoice, optionally closing the gap in that month's sequence
export function DeleteRegularDialog({ invoice, al, isOnline, onClose, onDeleted }) {
  const toast = useToast();
  const [closeGap, setCloseGap] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const word = al ? 'FSHI' : 'DELETE';

  async function remove(e) {
    e.preventDefault();
    if (!isOnline) return toast.error(al ? 'Fshirja e faturës së rregullt kërkon internet.' : 'Deleting a regular invoice requires internet.');
    setDeleting(true);
    const { data: moved, error } = await supabase.rpc('delete_regular_invoice', { p_service_id: invoice.id, p_close_gap: closeGap });
    setDeleting(false);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    toast.success(al
      ? `Fatura ${invoice.regular_number} u fshi.${moved ? ` ${moved} fatura u rinumëruan.` : ''}`
      : `Invoice ${invoice.regular_number} deleted.${moved ? ` ${moved} invoice${moved === 1 ? ' was' : 's were'} renumbered.` : ''}`);
    onDeleted();
  }

  return (
    <Modal title={al ? `Fshi faturën ${invoice.regular_number}` : `Delete invoice ${invoice.regular_number}`} onClose={onClose}>
      <form onSubmit={remove}>
        <div className="p-4 md:p-5 space-y-4 text-sm">
          <p className="text-gray-700">
            {al
              ? 'Kjo faturë e rregullt do të fshihet përgjithmonë bashkë me artikujt e saj.'
              : 'This regular invoice and its line items will be deleted permanently.'}
          </p>
          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="gap" className="mt-0.5" checked={!closeGap} onChange={() => setCloseGap(false)} />
              <span>
                <span className="font-medium text-gray-900">{al ? 'Mos i prek faturat e tjera' : 'Leave other invoices as they are'}</span>
                <span className="block text-xs text-gray-500">{al ? 'Numri mbetet i lirë (boshllëk në radhë).' : 'The number stays free (a gap in the sequence).'}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="gap" className="mt-0.5" checked={closeGap} onChange={() => setCloseGap(true)} />
              <span>
                <span className="font-medium text-gray-900">{al ? 'Mbyll boshllëkun' : 'Close the gap'}</span>
                <span className="block text-xs text-gray-500">
                  {al
                    ? 'Faturat e mëvonshme të këtij muaji zbresin një numër (p.sh. 05 → 04). Kujdes: faturat e printuara më parë do të kenë numër tjetër.'
                    : 'Later invoices of this month move down by one (e.g. 05 → 04). Careful: invoices already printed will then show a different number.'}
                </span>
              </span>
            </label>
          </fieldset>
          <div>
            <label className="label">{al ? `Shkruani ${word} për të konfirmuar` : `Type ${word} to confirm`}</label>
            <input className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)} />
          </div>
        </div>
        <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
          <button type="submit" disabled={deleting || confirmText.trim().toUpperCase() !== word} className="btn btn-danger">
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {al ? 'Fshi faturën' : 'Delete invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
