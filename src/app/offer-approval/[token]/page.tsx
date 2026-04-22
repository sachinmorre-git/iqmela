import { getApprovalDetailsAction } from "@/app/org-admin/offer-actions";
import { ApprovalSummaryClient } from "./ApprovalSummaryClient";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offer Approval Required",
};

interface PageProps {
  params: {
    token: string;
  };
}

export default async function OfferApprovalPage({ params }: PageProps) {
  const { token } = params;

  const res = await getApprovalDetailsAction(token);

  if (!res.success || !res.approval) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h1>
          <p className="text-gray-500">This approval link is no longer valid or has already been processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-12 md:pt-20">
      <ApprovalSummaryClient approval={res.approval} token={token} />
    </div>
  );
}
