import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const nunito = localFont({
  src: [
    {
      path: "./fonts/nunito-sans-normal.woff2",
      weight: "400 800",
      style: "normal",
    },
    {
      path: "./fonts/nunito-sans-italic.woff2",
      weight: "400 800",
      style: "italic",
    },
  ],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // Tab title is the committee name; pages with their own title show as
  // "<page> | <committee>".
  title: { default: "Fictional Ad Hoc", template: "%s | Fictional Ad Hoc" },
  description: "The Fearmonger Summit staff roster and crisis workspace.",
  icons: { icon: "/favicon.png", apple: "/favicon-apple.png" },
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", nunito.variable)}>
      <body className="min-h-screen">
        <Providers>
          <TooltipProvider>
            <Navbar />
            {props.children}
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
