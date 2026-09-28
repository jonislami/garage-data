import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Save, Upload, Loader2, Download, RotateCcw, FileJson, FileSpreadsheet,
  ShieldCheck, AlertTriangle, CheckCircle2, Package,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { PageHeader, useToast } from '../components/ui';
import { formatDate } from '../lib/format';
import {
  createBackup, downloadBackup, createStockBackup, downloadStockBackup,
  getLastBackupAt, readBackupFile, restoreBackup, exportCSV, RESTORE_GROUPS,
} from '../lib/backup';

const FISCAL_FIELDS = [
  'business_name', 'unique_number', 'fiscal_number', 'vat_number', 'email', 'website',
  'bank_name', 'bank_account_name', 'bank_account',
];

const TABLE_LABELS = {
  en: {
    clients: 'Clients', cars: 'Vehicles', inventory: 'Stock items', services: 'Invoices / jobs',
    service_items: 'Invoice lines', expenses: 'Expenses', appointments: 'Appointments', inspections: 'Inspections',
  },
  al: {
    clients: 'Klientët', cars: 'Veturat', inventory: 'Artikujt në stok', services: 'Faturat / punët',
    service_items: 'Rreshtat e faturave', expenses: 'Shpenzimet', appointments: 'Takimet', inspections: 'Inspektimet',
  },
};

const GROUP_LABELS = {
  en: {
    clients: ['Clients & vehicles', 'Customer records and their cars'],
    inventory: ['Stock', 'Parts, part numbers, quantities and prices'],
    invoices: ['Invoices', 'Jobs with all their line items'],
    expenses: ['Expenses', 'Shop costs'],
    appointments: ['Appointments', 'Calendar bookings'],
    inspections: ['Inspections', 'Inspection reports'],
  },
  al: {
    clients: ['Klientët & veturat', 'Të dhënat e klientëve dhe veturat e tyre'],
    inventory: ['Stoku', 'Pjesët, numrat e pjesëve, sasitë dhe çmimet'],
    invoices: ['Faturat', 'Punët me të gjithë artikujt'],
    expenses: ['Shpenzimet', 'Kostot e ofiçinës'],
    appointments: ['Takimet', 'Rezervimet në kalendar'],
    inspections: ['Inspektimet', 'Raportet e inspektimit'],
  },
};

function Section({ title, description, children }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 py-6 border-b border-gray-200 last:border-0">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="lg:col-span-2">{children}</div>
    </section>
  );
}

function BackupRestore({ al }) {
  const toast = useToast();
  const L = al ? 'al' : 'en';
  const fileRef = useRef(null);

  const [busy, setBusy] = useState(null); // 'backup' | 'restore' | 'csv'
  const [progress, setProgress] = useState('');
  const [lastBackup, setLastBackup] = useState(getLastBackupAt());
  const [pending, setPending] = useState(null); // parsed backup waiting for confirmation
  const [groups, setGroups] = useState(RESTORE_GROUPS.map(g => g.key));
  const [result, setResult] = useState(null);

  const label = tb => TABLE_LABELS[L][tb] || tb;

  async function handleBackup() {
    setBusy('backup'); setResult(null);
    try {
      const backup = await createBackup(tb => setProgress(`${al ? 'Duke lexuar' : 'Reading'} ${label(tb).toLowerCase()}…`));
      downloadBackup(backup);
      setLastBackup(backup.created_at);
      const total = Object.values(backup.counts).reduce((a, b) => a + b, 0);
      toast.success(al ? `Kopja rezervë u shkarkua (${total} rreshta).` : `Backup downloaded (${total} records).`);
    } catch (err) {
      toast.error((al ? 'Kopja rezervë dështoi: ' : 'Backup failed: ') + err.message);
    } finally {
      setBusy(null); setProgress('');
    }
  }

  async function handleStockBackup() {
    setBusy('stock'); setResult(null);
    try {
      const backup = await createStockBackup(() => setProgress(al ? 'Duke lexuar stokun…' : 'Reading stock…'));
      downloadStockBackup(backup);
      const n = backup.counts.inventory || 0;
      toast.success(al ? `Kopja e stokut u shkarkua (${n} artikuj).` : `Stock backup downloaded (${n} items).`);
    } catch (err) {
      toast.error((al ? 'Kopja e stokut dështoi: ' : 'Stock backup failed: ') + err.message);
    } finally {
      setBusy(null); setProgress('');
    }
  }

  async function handleCSV(kind) {
    setBusy('csv');
    try {
      const backup = await createBackup(() => {});
      exportCSV(kind, backup, al);
    } catch (err) {
      toast.error((al ? 'Eksporti dështoi: ' : 'Export failed: ') + err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    try {
      const backup = await readBackupFile(file);
      setPending({ backup, fileName: file.name });
      // Pre-select only groups that actually have data in the file
      setGroups(RESTORE_GROUPS.filter(g => g.tables.some(tb => (backup.data[tb] || []).length > 0)).map(g => g.key));
    } catch (err) {
      const msgs = {
        INVALID_JSON: al ? 'Skedari nuk është JSON i vlefshëm.' : 'The file is not valid JSON.',
        NOT_A_BACKUP: al ? 'Ky skedar nuk është kopje rezervë e GarageData.' : 'This file is not a GarageData backup.',
        NEWER_VERSION: al ? 'Kjo kopje është krijuar nga një version më i ri i aplikacionit.' : 'This backup was made by a newer version of the app.',
      };
      toast.error(msgs[err.message] || err.message);
    }
  }

  async function handleRestore() {
    if (!pending || groups.length === 0) return;
    const ok = window.confirm(al
      ? 'Të dhënat nga kopja do të shtohen dhe do të mbishkruajnë të dhënat ekzistuese me të njëjtin ID. Të dhënat e reja nuk fshihen. Vazhdo?'
      : 'Records from the backup will be added and will overwrite existing records with the same ID. Newer records are not deleted. Continue?');
    if (!ok) return;

    setBusy('restore');
    try {
      const written = await restoreBackup(pending.backup, groups, tb => setProgress(`${al ? 'Duke rikthyer' : 'Restoring'} ${label(tb).toLowerCase()}…`));
      setResult(written);
      setPending(null);
      toast.success(al ? 'Rikthimi përfundoi.' : 'Restore complete.');
    } catch (err) {
      toast.error((al ? 'Rikthimi dështoi: ' : 'Restore failed: ') + err.message);
    } finally {
      setBusy(null); setProgress('');
    }
  }

  const daysSince = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;
  const stale = daysSince === null || daysSince >= 7;

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm ${stale ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
        {stale ? <AlertTriangle size={17} className="shrink-0 mt-px" /> : <ShieldCheck size={17} className="shrink-0 mt-px" />}
        <div>
          {lastBackup
            ? (al ? `Kopja e fundit në këtë pajisje: ${formatDate(lastBackup)} (${daysSince === 0 ? 'sot' : `para ${daysSince} ditësh`}).`
                  : `Last backup on this device: ${formatDate(lastBackup)} (${daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`}).`)
            : (al ? 'Nuk është bërë asnjë kopje rezervë nga kjo pajisje.' : 'No backup has been made from this device yet.')}
          {stale && <span className="block mt-0.5 text-amber-800">{al ? 'Rekomandohet një kopje rezervë çdo javë.' : 'We recommend making a backup every week.'}</span>}
        </div>
      </div>

      {/* Backup */}
      <div className="card">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500"><FileJson size={18} /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">{al ? 'Kopje rezervë e plotë' : 'Full backup'}</p>
              <p className="text-sm text-gray-500">{al ? 'Stoku, klientët, veturat, faturat, shpenzimet, takimet dhe inspektimet në një skedar .json.' : 'Stock, clients, vehicles, invoices, expenses, appointments and inspections in one .json file.'}</p>
            </div>
          </div>
          <button onClick={handleBackup} disabled={!!busy} className="btn btn-primary shrink-0">
            {busy === 'backup' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {al ? 'Shkarko kopjen' : 'Download backup'}
          </button>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500"><Package size={18} /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">{al ? 'Vetëm stoku (.json)' : 'Stock only (.json)'}</p>
              <p className="text-sm text-gray-500">{al ? 'Një skedar i vogël vetëm me stokun, që mund të rikthehet në një llogari tjetër.' : 'A small file with just your stock, that can be restored into another account.'}</p>
            </div>
          </div>
          <button onClick={handleStockBackup} disabled={!!busy} className="btn btn-secondary shrink-0">
            {busy === 'stock' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {al ? 'Shkarko stokun' : 'Download stock'}
          </button>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1 flex items-center gap-1.5"><FileSpreadsheet size={14} /> {al ? 'Eksporto për Excel (CSV, jo për rikthim):' : 'Export for Excel (CSV, not for restore):'}</span>
          <button onClick={() => handleCSV('inventory')} disabled={!!busy} className="btn btn-secondary btn-sm">{al ? 'Stoku' : 'Stock'}</button>
          <button onClick={() => handleCSV('clients')} disabled={!!busy} className="btn btn-secondary btn-sm">{al ? 'Klientët' : 'Clients'}</button>
          <button onClick={() => handleCSV('invoices')} disabled={!!busy} className="btn btn-secondary btn-sm">{al ? 'Faturat' : 'Invoices'}</button>
          {busy === 'csv' && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
      </div>

      {/* Restore */}
      <div className="card">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500"><RotateCcw size={18} /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">{al ? 'Rikthe nga kopja' : 'Restore from backup'}</p>
              <p className="text-sm text-gray-500">{al ? 'Zgjidh një skedar kopjeje dhe çfarë dëshiron të rikthesh.' : 'Choose a backup file and what you want to restore.'}</p>
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-secondary shrink-0">
            <Upload size={16} /> {al ? 'Zgjidh skedarin' : 'Choose file'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json,application/octet-stream,text/plain,text/json" className="hidden" onChange={handleFile} />
        </div>

        {pending && (
          <div className="border-t border-gray-200 p-4 space-y-4 animate-fade-in">
            <div className="text-sm">
              <p className="font-medium text-gray-900 break-all">{pending.fileName}</p>
              <p className="text-gray-500">
                {pending.backup.workshop?.name ? `${pending.backup.workshop.name} · ` : ''}
                {al ? 'krijuar më' : 'created'} {formatDate(pending.backup.created_at)}{' '}
                {new Date(pending.backup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESTORE_GROUPS.map(g => {
                const count = (pending.backup.data[g.tables[0]] || []).length;
                const [title, desc] = GROUP_LABELS[L][g.key];
                const checked = groups.includes(g.key);
                return (
                  <label key={g.key} className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'} ${count === 0 ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 accent-blue-600"
                      checked={checked}
                      disabled={count === 0}
                      onChange={e => setGroups(e.target.checked ? [...groups, g.key] : groups.filter(k => k !== g.key))}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{title}</span>
                        <span className="text-xs font-mono text-gray-500">{count}</span>
                      </span>
                      <span className="block text-xs text-gray-500">{desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="text-xs text-gray-500">
              {al
                ? 'Rikthimi shton të dhënat që mungojnë dhe mbishkruan ato që ekzistojnë me të njëjtin ID. Asgjë e krijuar pas kopjes nuk fshihet. Faturat rikthehen bashkë me veturat dhe klientët e tyre.'
                : 'Restore adds missing records and overwrites records with the same ID. Nothing created after the backup is deleted. Invoices are restored together with their vehicles and clients.'}
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button onClick={() => setPending(null)} disabled={busy === 'restore'} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
              <button onClick={handleRestore} disabled={!!busy || groups.length === 0} className="btn btn-primary">
                {busy === 'restore' ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {al ? 'Rikthe të zgjedhurat' : 'Restore selected'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="border-t border-gray-200 p-4 text-sm animate-fade-in">
            <p className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 size={16} /> {al ? 'U rikthyen:' : 'Restored:'}</p>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-gray-600">
              {Object.entries(result).map(([tb, n]) => (
                <li key={tb} className="flex justify-between gap-2"><span>{label(tb)}</span><span className="font-mono">{n}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {progress && <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> {progress}</p>}
    </div>
  );
}

export default function Settings() {
  const { language } = useLanguage();
  const al = language === 'al';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshopId, setWorkshopId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', address: '', phone: '', country: '', currency: '€', logo_url: '', vat_rate: 0,
    ...Object.fromEntries(FISCAL_FIELDS.map(k => [k, ''])),
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function fetchSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: workshop, error } = await supabase.from('workshops').select('*').eq('owner_id', user.id).single();
      if (error) throw error;
      if (workshop) {
        setWorkshopId(workshop.id);
        setFormData({
          name: workshop.name || '', address: workshop.address || '', phone: workshop.phone || '',
          country: workshop.country || '', currency: workshop.currency || '€', logo_url: workshop.logo_url || '',
          vat_rate: workshop.vat_rate || 0,
          ...Object.fromEntries(FISCAL_FIELDS.map(k => [k, workshop[k] || ''])),
        });
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let finalLogoUrl = formData.logo_url;
      if (logoFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const fileName = `${user.id}-${Date.now()}.${logoFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile);
        if (uploadError) throw uploadError;
        finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl;
      }
      const { error } = await supabase.from('workshops').update({
        name: formData.name, address: formData.address, phone: formData.phone,
        country: formData.country, currency: formData.currency, logo_url: finalLogoUrl, vat_rate: formData.vat_rate,
        ...Object.fromEntries(FISCAL_FIELDS.map(k => [k, formData[k].trim()])),
      }).eq('id', workshopId);
      if (error) throw error;
      setFormData(f => ({ ...f, logo_url: finalLogoUrl }));
      setLogoFile(null);
      toast.success(al ? 'Cilësimet u ruajtën.' : 'Settings saved.');
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Error saving settings: ') + error.message);
    } finally { setSaving(false); }
  }

  const set = key => e => setFormData({ ...formData, [key]: e.target.value });

  return (
    <div className="page max-w-5xl">
      <PageHeader
        title={al ? 'Cilësimet' : 'Settings'}
        subtitle={al ? 'Të dhënat e biznesit, logoja dhe kopjet rezervë.' : 'Business details, branding and backups.'}
      />

      {loading ? (
        <div className="space-y-3"><div className="skeleton h-5 w-40" /><div className="skeleton h-9 w-full" /><div className="skeleton h-9 w-full" /></div>
      ) : (
        <>
          <form onSubmit={handleSave}>
            <Section title={al ? 'Logoja' : 'Branding'} description={al ? 'Shfaqet në faturat dhe raportet tuaja.' : 'Shown on your invoices and reports.'}>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 rounded-md border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                  {logoPreview || formData.logo_url
                    ? <img src={logoPreview || formData.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                    : <span className="text-xs text-gray-400">{al ? 'Pa logo' : 'No logo'}</span>}
                </div>
                <div className="min-w-0">
                  <label className="btn btn-secondary cursor-pointer">
                    <Upload size={16} /> {al ? 'Ngarko logon' : 'Upload logo'}
                    <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                  </label>
                  <p className="mt-1.5 text-xs text-gray-500 truncate">{logoFile ? logoFile.name : 'PNG / JPG, ' + (al ? 'mundësisht me sfond transparent' : 'ideally with a transparent background')}</p>
                </div>
              </div>
            </Section>

            <Section title={al ? 'Të dhënat e biznesit' : 'Business details'} description={al ? 'Këto të dhëna shfaqen në krye të faturës.' : 'These details appear at the top of every invoice.'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">{al ? 'Emri i ofiçinës' : 'Workshop name'}</label>
                  <input required className="input" value={formData.name} onChange={set('name')} />
                </div>
                <div>
                  <label className="label">{al ? 'Telefoni' : 'Phone'}</label>
                  <input className="input" placeholder="+383 …" value={formData.phone} onChange={set('phone')} />
                </div>
                <div>
                  <label className="label">{al ? 'Adresa' : 'Address'}</label>
                  <input className="input" value={formData.address} onChange={set('address')} />
                </div>
                <div>
                  <label className="label">{al ? 'Monedha' : 'Currency'}</label>
                  <select className="input" value={formData.currency} onChange={set('currency')}>
                    <option value="€">EUR (€)</option><option value="$">USD ($)</option><option value="£">GBP (£)</option><option value="L">ALL (L)</option>
                  </select>
                </div>
                <div>
                  <label className="label">{al ? 'TVSH' : 'VAT rate'}</label>
                  <select className="input" value={formData.vat_rate} onChange={set('vat_rate')}>
                    <option value="0">0% — {al ? 'nën pragun e TVSH-së' : 'below VAT threshold'}</option>
                    <option value="8">8% — {al ? 'normë e reduktuar' : 'reduced rate'}</option>
                    <option value="18">18% — {al ? 'normë standarde (Kosovë)' : 'standard rate (Kosovo)'}</option>
                  </select>
                </div>
              </div>

              <p className="section-label mt-6">{al ? 'Për faturë të rregullt' : 'For regular (fiscal) invoices'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">{al ? 'Emri i biznesit (i regjistruar)' : 'Registered business name'}</label>
                  <input className="input" placeholder={al ? 'p.sh. Alton Islami BI' : 'e.g. Alton Islami BI'} value={formData.business_name} onChange={set('business_name')} />
                </div>
                <div>
                  <label className="label">{al ? 'Nr. unik' : 'Unique number (Nr. unik)'}</label>
                  <input className="input font-code" value={formData.unique_number} onChange={set('unique_number')} />
                </div>
                <div>
                  <label className="label">{al ? 'Nr. fiskal' : 'Fiscal number'}</label>
                  <input className="input font-code" value={formData.fiscal_number} onChange={set('fiscal_number')} />
                </div>
                <div>
                  <label className="label">{al ? 'Nr. TVSH' : 'VAT number'}</label>
                  <input className="input font-code" value={formData.vat_number} onChange={set('vat_number')} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={formData.email} onChange={set('email')} />
                </div>
                <div>
                  <label className="label">{al ? 'Uebfaqja' : 'Website'}</label>
                  <input className="input" placeholder="www…" value={formData.website} onChange={set('website')} />
                </div>
                <div>
                  <label className="label">{al ? 'Emri i bankës' : 'Bank name'}</label>
                  <input className="input" value={formData.bank_name} onChange={set('bank_name')} />
                </div>
                <div>
                  <label className="label">{al ? 'Emri i llogarisë' : 'Account name'}</label>
                  <input className="input" value={formData.bank_account_name} onChange={set('bank_account_name')} />
                </div>
                <div>
                  <label className="label">{al ? 'Nr. i llogarisë' : 'Account number'}</label>
                  <input className="input font-code" value={formData.bank_account} onChange={set('bank_account')} />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {al ? 'Ruaj ndryshimet' : 'Save changes'}
                </button>
              </div>
            </Section>
          </form>

          <Section
            title={al ? 'Kopja rezervë & rikthimi' : 'Backup & restore'}
            description={al
              ? 'Shkarko një kopje të të gjitha të dhënave dhe ruaje në kompjuter, USB ose Google Drive. Me të mund t’i rikthesh stokun, klientët dhe faturat.'
              : 'Download a copy of all your data and keep it on your computer, a USB stick or Google Drive. Use it to bring back stock, clients and invoices.'}
          >
            <BackupRestore al={al} />
          </Section>
        </>
      )}
    </div>
  );
}
