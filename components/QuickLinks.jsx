'use client';

import { useState } from 'react';

const EMPTY_FORM = { title: '', url: '', description: '' };

function prettyUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

export default function QuickLinks({ initialLinks, initialError }) {
  const [links, setLinks] = useState(initialLinks || []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  async function refresh() {
    const res = await fetch('/api/links', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat link.');
    setLinks(data.links);
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.url.trim()) {
      setError('URL wajib diisi.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch(editingId ? `/api/links/${editingId}` : '/api/links', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan link.');
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(link) {
    setEditingId(link.id);
    setForm({
      title: link.title || '',
      url: link.url || '',
      description: link.description || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(link) {
    if (!window.confirm(`Hapus "${link.title}"?`)) return;
    try {
      const res = await fetch(`/api/links/${link.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus link.');
      }
      if (editingId === link.id) resetForm();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy(link) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1200);
    } catch {
      window.prompt('Copy URL berikut:', link.url);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login';
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Quick Link</h1>
          <p className="muted">{links.length} link tersimpan</p>
        </div>
        <button type="button" className="btn ghost" onClick={handleLogout}>
          Keluar
        </button>
      </header>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="row">
          <input
            className="input"
            placeholder="Tempel URL di sini (contoh: google.com)"
            value={form.url}
            onChange={(e) => updateField('url', e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div className="row two">
          <input
            className="input"
            placeholder="Judul (opsional)"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
          <input
            className="input"
            placeholder="Catatan (opsional)"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Link'}
          </button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Batal
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {links.map((link) => (
          <li key={link.id} className="card item">
            <div className="item-main">
              <a className="item-title" href={link.url} target="_blank" rel="noreferrer">
                {link.title}
              </a>
              <span className="item-url muted">{prettyUrl(link.url)}</span>
              {link.description && <p className="item-desc">{link.description}</p>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn small" onClick={() => handleCopy(link)}>
                {copiedId === link.id ? 'Tersalin!' : 'Copy'}
              </button>
              <button type="button" className="btn small" onClick={() => startEdit(link)}>
                Edit
              </button>
              <button type="button" className="btn small danger" onClick={() => handleDelete(link)}>
                Hapus
              </button>
            </div>
          </li>
        ))}
        {links.length === 0 && (
          <li className="card empty muted">Belum ada link. Tambahkan yang pertama di atas.</li>
        )}
      </ul>
    </>
  );
}
