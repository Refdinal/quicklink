import './globals.css';

export const metadata = {
  title: 'Jadwal Rapat & Zoom',
  description: 'Kelola jadwal rapat dan zoom meeting dalam tampilan kalender.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
