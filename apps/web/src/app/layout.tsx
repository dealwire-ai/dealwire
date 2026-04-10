import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { clerkAppearance } from "@/lib/clerk-appearance";
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
  title: "Dealwire",
  description: "Deal intelligence. From inbox to IC memo.",
  metadataBase: new URL("https://dealwire.ai"),
  openGraph: {
    title: "Dealwire",
    description: "Deal intelligence. From inbox to IC memo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dealwire",
    description: "Deal intelligence. From inbox to IC memo.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body
          className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} font-sans antialiased`}
        >
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#18181b",
                border: "1px solid #27272a",
                color: "#fafafa",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
