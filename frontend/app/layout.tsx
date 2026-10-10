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
  title: "Fearmonger Union | Summit Register",
  description: "The Fearmonger Summit staff roster and crisis workspace.",
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
