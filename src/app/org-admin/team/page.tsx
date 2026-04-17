import { OrganizationProfile } from "@clerk/nextjs";

export const metadata = {
  title: "Team & Workspace | Org Admin",
}

export default function OrgTeamPage() {
  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto p-4 md:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Team & Workspace Settings
        </h2>
        <p className="text-muted-foreground mt-1 text-zinc-400">
          Manage your organization members, invite new teammates (Recruiters, Interviewers), and customize your tenant profile.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <OrganizationProfile 
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full flex justify-center",
              card: "shadow-none bg-transparent w-full max-w-none dark:text-zinc-100",
              navbar: "border-r border-gray-200 dark:border-zinc-800 dark:bg-zinc-900/50",
              navbarButton: "dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800",
              headerTitle: "dark:text-zinc-100",
              headerSubtitle: "dark:text-zinc-400",
              profileSectionTitle: "dark:text-zinc-100 border-b border-gray-200 dark:border-zinc-800",
              profileSectionContent: "dark:text-zinc-300",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
              badge: "dark:bg-blue-900/30 dark:text-blue-400 border dark:border-blue-800",
              userPreviewMainIdentifier: "dark:text-zinc-100",
              userPreviewSecondaryIdentifier: "dark:text-zinc-400",
              scrollBox: "dark:bg-zinc-900"
            }
          }}
        />
      </div>
    </div>
  );
}
