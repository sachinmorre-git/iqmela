import { getCallerPermissions } from "@/lib/rbac";
import { getClientPastVendors } from "@/lib/vendor-provisioning";
import { redirect } from "next/navigation";
import { Building2, Search, Plus, Mail, Phone, Users, ShieldAlert } from "lucide-react";
import { VendorsListClient } from "./VendorsListClient";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = {
  title: "Vendors | IQMela",
};

export default async function VendorsPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/sign-in");
  
  if (!perms.canManagePositions) {
    return (
      <div className="flex flex-col gap-6 md:gap-8 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Vendor Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
              Manage your third-party agency relationships.
            </p>
          </div>
        </div>
        <EmptyState
          icon={<ShieldAlert className="w-8 h-8" />}
          title="Access Denied"
          description="You do not have permission to manage vendors for this organization."
        />
      </div>
    );
  }

  const vendors = await getClientPastVendors(perms.orgId);

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full max-w-[1200px] mx-auto px-4 md:px-0 mt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Vendor Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Build and manage your explicit address book of recruitment agencies.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-500" />
                Managed Vendors Directory
              </h2>
              <div className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-zinc-900 px-3 py-1 rounded-full">
                {vendors.length} Total
              </div>
            </div>
            
            {vendors.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-rose-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Vendors Yet</h3>
                <p className="text-gray-500 dark:text-zinc-400 max-w-sm">
                  Add your first vendor agency using the form to start dispatching jobs securely.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                  <thead className="bg-gray-50 dark:bg-zinc-900/50 text-xs uppercase font-semibold text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-5 py-3">Agency Name</th>
                      <th className="px-5 py-3">Domain</th>
                      <th className="px-5 py-3">Contact Email</th>
                      <th className="px-5 py-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/20 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {vendor.name.charAt(0).toUpperCase()}
                            </div>
                            {vendor.name}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-zinc-400">
                          {vendor.domain || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-zinc-400">
                          {vendor.email}
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-zinc-400">
                          {vendor.phone}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <VendorsListClient />
        </div>
      </div>
    </div>
  );
}
