import { Suspense } from "react";
import { CentralProvider } from "@/components/providers/central-provider";
import { Background } from "@/components/shell/background";
import { CommandPalette } from "@/components/shell/command-palette";
import { BottomNav, MobileHeader } from "@/components/shell/mobile-nav";
import { QuickEntry, QuickEntryFab } from "@/components/shell/quick-entry";
import { Sidebar } from "@/components/shell/sidebar";
import { SignalLayer } from "@/components/shell/signal-layer";
import { requireMember } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { NotificationBell } from "@/components/notifications/notification-bell";

async function Shell({ children }: { children: React.ReactNode }) {
  const { central } = await requireMember();
  const areas = await central.listAllAreas();
  const connection = {
    mcpUrl: `${serverEnv.appUrl}/api/mcp/${serverEnv.mcpSecret}`,
    openApiUrl: `${serverEnv.appUrl}/api/v1/openapi.json`,
  };

  return (
    <CentralProvider initialAreas={areas} connection={connection}>
      <MobileHeader />
      <Sidebar />
      <div className="fixed top-[calc(env(safe-area-inset-top)+0.6rem)] right-24 z-40 rounded-xl bg-background/95 md:top-4 md:right-4 md:border md:p-1">
        <NotificationBell />
      </div>
      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-16">
          {children}
        </main>
      </div>
      <BottomNav />
      <QuickEntryFab />
      <QuickEntry />
      <CommandPalette />
      <SignalLayer />
    </CentralProvider>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh">
      <div className="glass fixed inset-y-3 left-3 hidden w-60 rounded-2xl md:block" />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-8 md:pl-72">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Background />
      <Suspense fallback={<ShellFallback />}>
        <Shell>{children}</Shell>
      </Suspense>
    </>
  );
}
