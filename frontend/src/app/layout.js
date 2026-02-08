import TopBar from './TopBar';
import Providers from './providers';

export const metadata = { title: 'POI Predictor — Flare' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f12', color: '#e4e4e7' }}>
        <Providers>
          <TopBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
