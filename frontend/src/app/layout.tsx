import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blink — Ephemeral Rooms",
  description: "Secure, ephemeral chat rooms with real-time video. No traces left behind.",
  icons: {
    icon: "/blink-logo.png",
    apple: "/blink-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              color: '#e4e4e7',
              borderRadius: '1rem',
            },
          }}
        />
      </body>
    </html>
  );
}
