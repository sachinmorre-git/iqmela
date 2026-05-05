import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationsPageClient } from "./NotificationsPageClient";
import type { Metadata } from "next";
import { getCallerPermissions } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Notifications | IQMela",
};

export default async function NotificationsPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");
  const userId = perms.userId;

  const notifications = await prisma.notification.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false, isArchived: false },
  });

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
      </div>

      <NotificationsPageClient
        initialNotifications={JSON.parse(JSON.stringify(notifications))}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
