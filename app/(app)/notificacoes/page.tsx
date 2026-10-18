import { PageHeader } from "@/components/shell/page-header";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
export const metadata = { title: "Notificações" };
export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notificações"
        description="Prazos, entregas e decisões que precisam de você."
      />
      <NotificationInbox />
    </>
  );
}
