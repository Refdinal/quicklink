'use client';

import { useEffect, useMemo, useState } from 'react';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DEFAULT_DURATION_MINUTES = 180;

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

function keyFromIso(iso) {
  return iso ? String(iso).slice(0, 10) : '';
}

function minutesOfDay(iso) {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function timeLabel(iso) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      const start = new Date(meeting.start_at);
      const end = new Date(meeting.end_at);
      return {
        ...meeting,
        dayKey: keyFromDate(start),
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: Math.max(end.getHours() * 60 + end.getMinutes(), start.getHours() * 60 + start.getMinutes() + 1),
      };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

export default function ScheduleApp({ initialMeetings, initialError }) {
  const [meetings, setMeetings] = useState(initialMeetings || []);
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('month');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [focusKey, setFocusKey] = useState(() => keyFromDate(today));

  const events = useMemo(() => buildEvents(meetings), [meetings]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      if (!map.has(event.dayKey)) map.set(event.dayKey, []);
      map.get(event.dayKey).push(event);
    }
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((item) => new Date(item.end_at).getTime() >= now)
      .slice(0, 5);
  }, [events]);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const todayKey = keyFromDate(today);

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

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function goMonth(delta) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setFocusKey(keyFromDate(now));
  }

  function openDay(dayKey) {
    setFocusKey(dayKey);
    setView('day');
  }

  function chooseDay(dayKey) {
    setFocusKey(dayKey);
    updateField('date', dayKey);
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
    const endTime = endDefaults(form.start, form.end);
    const end_at = `${form.date}T${endTime}:00`;
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
      resetForm();
      setFocusKey(form.date);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(meeting) {
    const start = timeLabel(meeting.start_at);
    setEditingId(meeting.id);
    setForm({
      title: meeting.title || '',
      type: meeting.type || 'rapat',
      location: meeting.location || '',
      link: meeting.link || '',
      date: keyFromIso(meeting.start_at),
      start,
      end: timeLabel(meeting.end_at),
      notes: meeting.notes || '',
    });
    setError('');
    if (window.innerWidth < 900) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (editingId === meeting.id) resetForm();
      await refresh();
    } catch (err) {
      setError(err.message);
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
        <button type="button" className="btn ghost" onClick={handleLogout}>
          Keluar
        </button>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <form className="card form" onSubmit={handleSubmit}>
            <h2 className="form-title">{editingId ? 'Ubah Jadwal' : 'Buat Jadwal'}</h2>

            <label className="field">
              <span>Tema rapat</span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                autoComplete="off"
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
              {editingId && (
                <button type="button" className="btn ghost" onClick={resetForm}>
                  Batal
                </button>
              )}
            </div>
          </form>

          {upcoming.length > 0 && (
            <div className="card upcoming">
              <h2 className="form-title">Jadwal Berikutnya</h2>
              <ul>
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="upcoming-link" onClick={() => openDay(item.dayKey)}>
                      <span className={`dot ${item.type}`} />
                      <span>
                        <strong>{item.title}</strong>
                        <span className="muted">
                          {new Date(item.start_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}{' '}
                          {timeLabel(item.start_at)}–{timeLabel(item.end_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="calendar card">
          <div className="cal-head">
            <div className="cal-title">
              <h2>
                {view === 'month'
                  ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
                  : new Date(`${focusKey}T00:00:00`).toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
              </h2>
            </div>
            <div className="cal-actions">
              {view === 'month' ? (
                <>
                  <button type="button" className="btn small" onClick={() => goMonth(-1)} aria-label="Bulan sebelumnya">
                    ‹
                  </button>
                  <button type="button" className="btn small" onClick={goToday}>
                    Hari ini
                  </button>
                  <button type="button" className="btn small" onClick={() => goMonth(1)} aria-label="Bulan berikutnya">
                    ›
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn small" onClick={() => setFocusKey(keyFromDate(addDays(new Date(`${focusKey}T00:00:00`), -1)))}>
                    ‹
                  </button>
                  <button type="button" className="btn small" onClick={goToday}>
                    Hari ini
                  </button>
                  <button type="button" className="btn small" onClick={() => setFocusKey(keyFromDate(addDays(new Date(`${focusKey}T00:00:00`), 1)))}>
                    ›
                  </button>
                </>
              )}
              <div className="segmented view-toggle">
                <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
                  Bulan
                </button>
                <button type="button" className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>
                  Hari
                </button>
              </div>
            </div>
          </div>

          {view === 'month' ? (
            <>
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
                      onClick={() => chooseDay(key)}
                    >
                      <button
                        type="button"
                        className="cell-day"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDay(key);
                        }}
                      >
                        {day.getDate()}
                      </button>
                      <div className="cell-events">
                        {dayEvents.slice(0, 3).map((item) => (
                          <span key={item.id} className={`chip ${item.type}`} title={item.title}>
                            <span className="chip-time">{timeLabel(item.start_at)}</span>
                            <span className="chip-title">{item.title}</span>
                          </span>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="chip more">+{dayEvents.length - 3} lainnya</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <DayView
              dayKey={focusKey}
              events={eventsByDay.get(focusKey) || []}
              onEdit={startEdit}
              onDelete={handleDelete}
              onAdd={() => {
                updateField('date', focusKey);
                document.querySelector('.sidebar')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function DayView({ dayKey, events, onEdit, onDelete, onAdd }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();
  const showNow = keyFromDate(now) === dayKey;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="day-view">
      <div className="day-toolbar">
        <span className="muted">{events.length} jadwal pada hari ini</span>
        <button type="button" className="btn small primary" onClick={onAdd}>
          + Jadwal di hari ini
        </button>
      </div>
      <div className="day-scroll">
        <div className="day-grid">
          <div className="time-col">
            {hours.map((hour) => (
              <div key={hour} className="time-slot">
                {pad(hour)}:00
              </div>
            ))}
          </div>
          <div className="slots-col">
            {hours.map((hour) => (
              <div key={hour} className="hour-line" />
            ))}
            {events.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`event-block ${item.type}`}
                style={{
                  top: `${(item.startMin / 1440) * 100}%`,
                  height: `${((item.endMin - item.startMin) / 1440) * 100}%`,
                }}
                onClick={() => onEdit(item)}
              >
                <strong>{item.title}</strong>
                <span>
                  {timeLabel(item.start_at)}–{timeLabel(item.end_at)}
                </span>
                {item.type === 'zoom' && item.link && (
                  <span className="event-sub" onClick={(e) => {
                    e.stopPropagation();
                    window.open(item.link, '_blank', 'noreferrer');
                  }}>
                    Buka Zoom ↗
                  </span>
                )}
                {item.type === 'rapat' && item.location && (
                  <span className="event-sub">{item.location}</span>
                )}
                <span
                  className="event-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                >
                  Hapus
                </span>
              </button>
            ))}
            {showNow && (
              <div className="now-line" style={{ top: `${(nowMin / 1440) * 100}%` }}>
                <span className="now-dot" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
