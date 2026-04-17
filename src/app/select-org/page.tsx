import { OrganizationList } from "@clerk/nextjs";

export default function SelectOrgPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Select Workspace</h1>
        <p className="text-zinc-400">Choose an organization to continue or create a new one.</p>
      </div>
      <OrganizationList 
        hidePersonal
        afterSelectOrganizationUrl="/org-admin/dashboard"
        afterCreateOrganizationUrl="/org-admin/dashboard"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl",
            headerTitle: "text-zinc-100",
            headerSubtitle: "text-zinc-400",
            organizationPreviewTextContainer: "text-zinc-200",
            userPreviewTextContainer: "text-zinc-200"
          }
        }}
      />
    </div>
  );
}
