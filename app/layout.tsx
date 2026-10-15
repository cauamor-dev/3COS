import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import { MotionProvider } from "@/components/providers/motion-provider";
import { ServiceWorker } from "@/components/providers/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexSerif = IBM_Plex_Serif({ variable: "--font-plex-serif", subsets: ["latin"], weight: ["500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "3C OS", template: "%s · 3C OS" },
  description: "O ambiente do Time CCC: memória compartilhada entre Claude e ChatGPT, agenda, tarefas e Mural num só lugar.",
  applicationName: "3C OS",
  appleWebApp: { capable: true, title: "3C OS", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050409",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // App feel on the installed PWA: no pinch zoom or sideways panning.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`dark ${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} antialiased`}>
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
