import { useEffect } from 'react';

// Builds a safe file name: "Client - Invoice 01-102026 - AB-123-CD - 05.10.2026"
export function fileName(...parts) {
  return parts
    .filter(p => p && p !== '—')
    .map(p => String(p).replace(/[\\/:*?"<>|#]+/g, '-').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' - ');
}

// "Save as PDF" names the file after the page title, so set it while this page is open
// (covers the Print button and Ctrl+P alike).
export function usePrintTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}
