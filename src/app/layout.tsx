import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AskAiAgent } from "@/components/AskAiAgent";
import { CartProvider } from "@/components/CartProvider";
import { CompareBasketProvider } from "@/components/CompareBasketProvider";
import { DevToolsModal } from "@/components/DevToolsModal";
import { RecentlyViewedProvider } from "@/components/RecentlyViewedProvider";
import { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Importnest — Compare smarter. Shop confidently.",
  description:
    "Compare purchasing options across approved online sources with transparent, explainable recommendations.",
  icons: {
    icon: [
      { url: "/brand/importnest-icon.png", type: "image/png" },
      { url: "/brand/favicon-dark.png", type: "image/png" },
      { url: "/brand/favicon-light.png", type: "image/png", media: "(prefers-color-scheme: light)" },
    ],
    apple: "/brand/importnest-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-surface font-sans text-foreground antialiased">
        <CompareBasketProvider>
          <CartProvider>
            <RecentlyViewedProvider>
              {children}
              <AskAiAgent />
              <DevToolsModal />
            </RecentlyViewedProvider>
          </CartProvider>
        </CompareBasketProvider>
      </body>
    </html>
  );
}
