'use client';

import { useMemo, useState } from 'react';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DEFAULT_DURATION_MINUTES = 180;
const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || 'Asia/Jakarta';

const EMPTY_FORM = {
  title: '',
  type: 'rapat',
  location: '',
  link: '',
  date: '',
  start: '',
  end: '',
  notes: '',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKeyFromParts(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function keyFromDate(date) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

// Tanggal dari database (ISO UTC) disimpan backend sebagai jam dinding
// aplikasi, jadi dibaca apa adanya tanpa konversi timezone browser.
function wallClockParts(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { dayKey: '', minutes: 0, label: '' };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    label: `${get('hour')}:${get('minute')}`,
  };
}

function keyFromIso(iso) {
  return wallClockParts(iso).dayKey;
}

function timeLabel(iso) {
  return wallClockParts(iso).label;
}

function formatDateLabel(dayKey) {
  if (!dayKey) return '';
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDuration(minutes) {
  const total = Math.max(0, minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours} jam ${mins} menit`;
  if (hours) return `${hours} jam`;
  return `${mins} menit`;
}

function endDefaults(start, end) {
  if (!start) return end;
  if (end && end > start) return end;
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + DEFAULT_DURATION_MINUTES;
  return `${pad(Math.floor((total % 1440) / 60))}:${pad(total % 60)}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(start, i));
  }
  return days;
}

function buildEvents(meetings) {
  return meetings
    .map((meeting) => {
      const start = wallClockParts(meeting.start_at);
      const end = wallClockParts(meeting.end_at);
      return {
        ...meeting,
        dayKey: start.dayKey,
        startMin: start.minutes,
        endMin: Math.max(end.minutes, start.minutes + 1),
      };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

export default function ScheduleApp({ initialMeetings, initialError }) {
  const [meetings, setMeetings] = useState(initialMeetings || []);
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(null);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const events = useMemo(() => buildEvents(meetings), [meetings]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      if (!map.has(event.dayKey)) map.set(event.dayKey, []);
      map.get(event.dayKey).push(event);
    }
    return map;
  }, [events]);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const todayKey = keyFromDate(today);

  const detailEvents = detailKey ? eventsByDay.get(detailKey) || [] : [];

  async function refresh() {
    const res = await fetch('/api/meetings', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal.');
    setMeetings(data.meetings);
  }

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'start') {
        next.end = endDefaults(value, prev.end);
      }
      return next;
    });
  }

  function goMonth(delta) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setDetailKey(keyFromDate(now));
  }

  function openCreate(dayKey) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: dayKey || todayKey });
    setError('');
    setModalOpen(true);
  }

  function openEdit(meeting) {
    setEditingId(meeting.id);
    setForm({
      title: meeting.title || '',
      type: meeting.type || 'rapat',
      location: meeting.location || '',
      link: meeting.link || '',
      date: keyFromIso(meeting.start_at),
      start: timeLabel(meeting.start_at),
      end: timeLabel(meeting.end_at),
      notes: meeting.notes || '',
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Tema rapat wajib diisi.');
      return;
    }
    if (!form.date || !form.start) {
      setError('Tanggal dan jam mulai wajib diisi.');
      return;
    }
    if (form.type === 'zoom' && !form.link.trim()) {
      setError('Link Zoom wajib diisi untuk tipe Zoom.');
      return;
    }

    const start_at = `${form.date}T${form.start}:00`;
    const end_at = `${form.date}T${endDefaults(form.start, form.end)}:00`;
    let link = form.link.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      link = `https://${link}`;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch(editingId ? `/api/meetings/${editingId}` : '/api/meetings', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, link, start_at, end_at }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal.');
      closeModal();
      setDetailKey(form.date);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(meeting) {
    if (!window.confirm(`Hapus jadwal "${meeting.title}"?`)) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus jadwal.');
      }
      await refresh();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login';
  }

  return (
    <div className="schedule">
      <header className="topbar">
        <div>
          <h1>Jadwal Rapat &amp; Zoom</h1>
          <p className="muted">
            {meetings.length} jadwal tersimpan · durasi default {formatDuration(DEFAULT_DURATION_MINUTES)}
          </p>
        </div>
        <div className="cal-actions">
          <button type="button" className="btn primary" onClick={() => openCreate(todayKey)}>
            + Tambah Jadwal
          </button>
          <button type="button" className="btn ghost" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>

      <div className="layout single">
        <section className="calendar card">
          <div className="cal-head">
            <h2 className="cal-month">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
            <div className="cal-nav">
              <button type="button" className="btn small" onClick={() => goMonth(-1)} aria-label="Bulan sebelumnya">
                ‹
              </button>
              <button type="button" className="btn small" onClick={goToday}>
                Hari ini
              </button>
              <button type="button" className="btn small" onClick={() => goMonth(1)} aria-label="Bulan berikutnya">
                ›
              </button>
            </div>
          </div>

          <div className="month-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="month-grid">
            {days.map((day) => {
              const key = keyFromDate(day);
              const dayEvents = eventsByDay.get(key) || [];
              const outside = day.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={`month-cell${outside ? ' outside' : ''}${key === todayKey ? ' today' : ''}`}
                  onClick={() => setDetailKey(key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailKey(key);
                    }
                  }}
                >
                  <div className="cell-head">
                    <span className="cell-day">{day.getDate()}</span>
                    <button
                      type="button"
                      className="cell-add"
                      aria-label="Tambah jadwal"
                      title="Tambah jadwal"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreate(key);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="cell-events">
                    {dayEvents.map((item) => (
                      <span key={item.id} className={`chip ${item.type}`} title={item.title}>
                        <span className="chip-time">{timeLabel(item.start_at)}</span>
                        <span className="chip-title">{item.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {detailKey && (
        <div className="overlay" onClick={() => setDetailKey(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 className="form-title">Detail Jadwal</h2>
                <p className="muted">{formatDateLabel(detailKey)}</p>
              </div>
              <div className="modal-head-actions">
                <button type="button" className="btn small primary" onClick={() => openCreate(detailKey)}>
                  + Tambah
                </button>
                <button type="button" className="btn small ghost" onClick={() => setDetailKey(null)} aria-label="Tutup">
                  ✕
                </button>
              </div>
            </div>

            {detailEvents.length === 0 ? (
              <p className="empty muted">Belum ada jadwal pada hari ini.</p>
            ) : (
              <ul className="detail-list">
                {detailEvents.map((item) => (
                  <li key={item.id} className={`detail-item ${item.type}`}>
                    <div className="detail-main">
                      <div className="detail-time">
                        {timeLabel(item.start_at)} – {timeLabel(item.end_at)}
                        <span className={`badge ${item.type}`}>
                          {item.type === 'zoom' ? 'Zoom' : 'Rapat'}
                        </span>
                      </div>
                      <strong className="detail-title">{item.title}</strong>
                      {item.type === 'zoom' && item.link && (
                        <a className="detail-link" href={item.link} target="_blank" rel="noreferrer">
                          {item.link}
                        </a>
                      )}
                      {item.type === 'rapat' && item.location && (
                        <span className="detail-sub">{item.location}</span>
                      )}
                      {item.notes && <span className="detail-sub">{item.notes}</span>}
                    </div>
                    <div className="item-actions">
                      <button type="button" className="btn small" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="btn small danger" onClick={() => handleDelete(item)}>
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="overlay" onClick={closeModal}>
          <form className="modal form-modal form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="form-title">{editingId ? 'Ubah Jadwal' : 'Tambah Jadwal'}</h2>
              <button type="button" className="btn small ghost" onClick={closeModal} aria-label="Tutup">
                ✕
              </button>
            </div>

            <label className="field">
              <span>Tema rapat</span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>

            <div className="field">
              <span>Tipe</span>
              <div className="segmented">
                <button
                  type="button"
                  className={form.type === 'rapat' ? 'active' : ''}
                  onClick={() => updateField('type', 'rapat')}
                >
                  Rapat
                </button>
                <button
                  type="button"
                  className={form.type === 'zoom' ? 'active' : ''}
                  onClick={() => updateField('type', 'zoom')}
                >
                  Zoom
                </button>
              </div>
            </div>

            {form.type === 'rapat' ? (
              <label className="field">
                <span>Ruangan</span>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                />
              </label>
            ) : (
              <label className="field">
                <span>Link Zoom</span>
                <input
                  className="input"
                  value={form.link}
                  onChange={(e) => updateField('link', e.target.value)}
                />
              </label>
            )}

            <label className="field">
              <span>Tanggal</span>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Mulai</span>
                <input
                  className="input"
                  type="time"
                  value={form.start}
                  onChange={(e) => updateField('start', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Selesai</span>
                <input
                  className="input"
                  type="time"
                  value={form.end}
                  onChange={(e) => updateField('end', e.target.value)}
                />
              </label>
            </div>
            <p className="hint">Kosongkan jam selesai → otomatis +3 jam.</p>

            <label className="field">
              <span>Catatan (opsional)</span>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </label>

            {error && <p className="error">{error}</p>}

            <div className="actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Jadwal'}
              </button>
              <button type="button" className="btn ghost" onClick={closeModal}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
