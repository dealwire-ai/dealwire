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
  title: "Dealwire — We build your firm's private intelligence layer",
  description:
    "Dealwire builds a bespoke private intelligence layer for institutional private-market firms — unifying decades of deal flow, memos, and broker relationships so your whole firm, and every AI you deploy, works from the same source of truth.",
  metadataBase: new URL("https://dealwire.ai"),
  openGraph: {
    title: "Dealwire — We build your firm's private intelligence layer",
    description:
      "A bespoke private intelligence layer for institutional CRE, real estate PE, family offices, and multi-strategy allocators.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dealwire — We build your firm's private intelligence layer",
    description:
      "A bespoke private intelligence layer for institutional CRE, real estate PE, family offices, and multi-strategy allocators.",
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
