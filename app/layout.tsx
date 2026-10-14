import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/providers/motion-provider";
import { ServiceWorker } from "@/components/providers/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Central 3C", template: "%s · Central 3C" },
  description: "Memória compartilhada entre Claude e ChatGPT: projetos, trabalho, estudos e decisões em um só lugar.",
  applicationName: "Central 3C",
  appleWebApp: { capable: true, title: "Central 3C", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07060b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`dark ${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <MotionProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster position="top-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
