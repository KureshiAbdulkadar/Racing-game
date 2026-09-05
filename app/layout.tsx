import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pixel Racer | 90+ FPS Retro Multiplayer Racing Game',
  description: 'A pixel-art multiplayer car racing game built with Next.js, locked 90+ FPS, room-code multiplayer lobbies, customizable cars, and chiptune audio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="crt-overlay" />
        <div className="crt-vignette" />
        {children}
      </body>
    </html>
  );
}
