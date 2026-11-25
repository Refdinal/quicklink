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

// Backend mengirim jam dinding polos "YYYY-MM-DDTHH:mm:ss" (tanpa zona).
// Dibaca apa adanya agar tidak dikonversi ke timezone browser/server.
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function wallClockParts(value) {
  const match = String(value || '').match(LOCAL_DATETIME);
  if (!match) {
    return { dayKey: '', minutes: 0, label: '' };
  }
  const [, year, month, day, hour, minute] = match;
  return {
    dayKey: `${year}-${month}-${day}`,
    minutes: Number(hour) * 60 + Number(minute),
    label: `${hour}:${minute}`,
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
  const [view, setView] = useState('month');
  const [dayKey, setDayKey] = useState(() => keyFromDate(new Date()));

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

  const dayEvents = eventsByDay.get(dayKey) || [];

  function openDay(key) {
    setDayKey(key);
    setView('day');
  }

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
    setDayKey(keyFromDate(now));
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
      setDayKey(form.date);
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
        <div className="brand">
          <h1>
            Jadwal <span className="gradient-word">Rapat</span> &amp; Zoom
          </h1>
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
          {view === 'month' ? (
            <>
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
                  const dayItems = eventsByDay.get(key) || [];
                  const outside = day.getMonth() !== cursor.getMonth();
                  return (
                    <div
                      key={key}
                      className={`month-cell${outside ? ' outside' : ''}${key === todayKey ? ' today' : ''}`}
                      onClick={() => openDay(key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDay(key);
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
                        {dayItems.map((item) => (
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
            </>
          ) : (
            <DayAgenda
              dayKey={dayKey}
              events={dayEvents}
              onBack={() => setView('month')}
              onPrev={() => setDayKey(keyFromDate(addDays(new Date(`${dayKey}T00:00:00`), -1)))}
              onNext={() => setDayKey(keyFromDate(addDays(new Date(`${dayKey}T00:00:00`), 1)))}
              onToday={() => setDayKey(keyFromDate(new Date()))}
              onAdd={() => openCreate(dayKey)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </section>
      </div>

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

const PX_PER_MINUTE = 0.9;

function nowWallClock() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function DayAgenda({ dayKey, events, onBack, onPrev, onNext, onToday, onAdd, onEdit, onDelete }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = nowWallClock();
  const showNow = now.dayKey === dayKey;

  return (
    <div className="agenda">
      <div className="agenda-head">
        <div className="agenda-title">
          <button type="button" className="btn small ghost" onClick={onBack}>
            ‹ Kalender
          </button>
          <div>
            <h2 className="cal-month">{formatDateLabel(dayKey)}</h2>
            <p className="muted">{events.length} jadwal</p>
          </div>
        </div>
        <div className="cal-nav">
          <button type="button" className="btn small" onClick={onPrev} aria-label="Hari sebelumnya">
            ‹
          </button>
          <button type="button" className="btn small" onClick={onToday}>
            Hari ini
          </button>
          <button type="button" className="btn small" onClick={onNext} aria-label="Hari berikutnya">
            ›
          </button>
          <button type="button" className="btn small primary" onClick={onAdd}>
            + Tambah
          </button>
        </div>
      </div>

      <div className="agenda-scroll">
        <div className="agenda-grid">
          <div className="agenda-times">
            {hours.map((hour) => (
              <div key={hour} className="agenda-time">
                {pad(hour)}:00
              </div>
            ))}
          </div>
          <div className="agenda-slots">
            {hours.map((hour) => (
              <div key={hour} className="agenda-hour" />
            ))}
            {events.map((item) => {
              const top = item.startMin * PX_PER_MINUTE;
              const height = Math.max((item.endMin - item.startMin) * PX_PER_MINUTE, 26);
              return (
                <div
                  key={item.id}
                  className={`agenda-event ${item.type}`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <button type="button" className="agenda-event-body" onClick={() => onEdit(item)}>
                    <span className="agenda-event-title">{item.title}</span>
                    <span className="agenda-event-time">
                      {timeLabel(item.start_at)}–{timeLabel(item.end_at)}
                    </span>
                    {item.type === 'zoom' && item.link && (
                      <a
                        className="agenda-event-link"
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Buka Zoom ↗
                      </a>
                    )}
                    {item.type === 'rapat' && item.location && (
                      <span className="agenda-event-sub">{item.location}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="agenda-event-del"
                    aria-label="Hapus jadwal"
                    onClick={() => onDelete(item)}
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
            {showNow && (
              <div className="agenda-now" style={{ top: `${now.minutes * PX_PER_MINUTE}px` }}>
                <span className="agenda-now-dot" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
