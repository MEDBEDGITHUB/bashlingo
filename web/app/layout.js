import './globals.css';
import TelegramBridge from './TelegramBridge';

export const metadata = {
  title: 'Ҙурбаш — башкирский язык',
  description: 'Учите башкирский короткими уроками: фразы, пары, сборка предложений.',
  icons: { icon: '/idle.png' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#237a46' };

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <TelegramBridge />
        {children}
      </body>
    </html>
  );
}
