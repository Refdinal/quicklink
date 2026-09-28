import './globals.css';

export const metadata = {
  title: 'Quick Link',
  description: 'Simpan dan akses link favorit dari device mana saja.',
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
