import { useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../LanguageContext';

// Shown after opening an invitation or password-reset link: the user picks their password.
export default function SetPassword({ invited, onDone }) {
  const { language } = useLanguage();
  const al = language === 'al';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(al ? 'Fjalëkalimi duhet të ketë të paktën 8 shkronja.' : 'The password must be at least 8 characters.');
    if (password !== confirm) return setError(al ? 'Fjalëkalimet nuk përputhen.' : 'The passwords do not match.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) return setError(err.message);
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form onSubmit={save} className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <img src="/applogo.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">Garage<span className="text-blue-600">Data</span></span>
        </div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <KeyRound size={18} /> {invited ? (al ? 'Mirë se vini! Zgjidhni fjalëkalimin' : 'Welcome! Choose your password') : (al ? 'Fjalëkalim i ri' : 'New password')}
        </h1>
        <p className="mt-1 mb-5 text-sm text-gray-500">
          {al ? 'Me këtë fjalëkalim do të kyçeni herët e tjera.' : 'You will use this password to sign in from now on.'}
        </p>
        <label className="label" htmlFor="pw">{al ? 'Fjalëkalimi' : 'Password'}</label>
        <input id="pw" type="password" autoComplete="new-password" autoFocus className="input mb-3" value={password} onChange={e => setPassword(e.target.value)} />
        <label className="label" htmlFor="pw2">{al ? 'Përsëriteni fjalëkalimin' : 'Repeat the password'}</label>
        <input id="pw2" type="password" autoComplete="new-password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary mt-5 w-full">
          {saving && <Loader2 size={16} className="animate-spin" />} {al ? 'Ruaj fjalëkalimin' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
