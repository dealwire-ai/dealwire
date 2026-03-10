import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Levine & Weinstein",
  description: "Deal intelligence. From inbox to IC memo.",
  metadataBase: new URL("https://deals.frontstep.ai"),
  openGraph: {
    title: "Levine & Weinstein",
    description: "Deal intelligence. From inbox to IC memo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Levine & Weinstein",
    description: "Deal intelligence. From inbox to IC memo.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} font-sans antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
