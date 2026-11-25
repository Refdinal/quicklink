export const DEFAULT_DURATION_MINUTES = 180;

export const MEETING_TYPES = [
  { value: 'rapat', label: 'Rapat' },
  { value: 'zoom', label: 'Zoom Meeting' },
];

export function normalizeType(value) {
  return value === 'zoom' ? 'zoom' : 'rapat';
}

// Input dari form berupa jam dinding lokal tanpa zona, mis. "2026-11-26T09:00:00".
// Kita pertahankan apa adanya (tanpa konversi timezone) supaya 09:00 tetap 09:00.
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function parseLocalDateTime(value) {
  if (!value) return null;
  const match = String(value).match(LOCAL_DATETIME);
  if (!match) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      seconds: date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds(),
    };
  }
  const [, year, month, day, hour, minute, second = '00'] = match;
  return {
    date: `${year}-${month}-${day}`,
    seconds: Number(hour) * 3600 + Number(minute) * 60 + Number(second),
  };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLocal(parts) {
  const hours = Math.floor(parts.seconds / 3600);
  const minutes = Math.floor((parts.seconds % 3600) / 60);
  const seconds = parts.seconds % 60;
  return `${parts.date} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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

  const start = parseLocalDateTime(body.start_at);
  if (!start) {
    return { error: 'Waktu mulai wajib diisi.' };
  }

  let end = parseLocalDateTime(body.end_at);
  if (!end) {
    // Jam selesai tidak diisi → +3 jam dari jam mulai.
    const extra = start.seconds + DEFAULT_DURATION_MINUTES * 60;
    const dayShift = Math.floor(extra / 86400);
    const dateObj = new Date(`${start.date}T00:00:00`);
    dateObj.setDate(dateObj.getDate() + dayShift);
    end = {
      date: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
      seconds: extra % 86400,
    };
  }

  const startKey = `${start.date} ${start.seconds}`;
  const endKey = `${end.date} ${end.seconds}`;
  if (endKey <= startKey) {
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
      start_at: formatLocal(start),
      end_at: formatLocal(end),
    },
  };
}
