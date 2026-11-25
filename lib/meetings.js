export const DEFAULT_DURATION_MINUTES = 180;

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Jakarta';

export const MEETING_TYPES = [
  { value: 'rapat', label: 'Rapat' },
  { value: 'zoom', label: 'Zoom Meeting' },
];

export function normalizeType(value) {
  return value === 'zoom' ? 'zoom' : 'rapat';
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Hasil: "YYYY-MM-DD HH:mm:ss" pada zona waktu aplikasi, aman disimpan ke
// kolom TIMESTAMPTZ (Postgres memakai TimeZone server, mis. GMT).
export function toWallClockString(value) {
  const date = parseDateTime(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function normalizeMeetingInput(body = {}) {
  const title = String(body.title || '').trim();
  const type = normalizeType(body.type);
  const location = String(body.location || '').trim();
  const link = String(body.link || '').trim();
  const notes = String(body.notes || '').trim();

  if (!title) {
    return { error: 'Tema rapat wajib diisi.' };
  }

  const start = parseDateTime(body.start_at);
  if (!start) {
    return { error: 'Waktu mulai wajib diisi.' };
  }

  let end = parseDateTime(body.end_at);
  if (!end) {
    end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  }
  if (end.getTime() <= start.getTime()) {
    return { error: 'Waktu selesai harus setelah waktu mulai.' };
  }
  if (type === 'zoom' && !link) {
    return { error: 'Link Zoom wajib diisi untuk tipe Zoom.' };
  }

  return {
    meeting: {
      title,
      type,
      location: location || null,
      link: link || null,
      notes: notes || null,
      start_at: toWallClockString(start),
      end_at: toWallClockString(end),
    },
  };
}
