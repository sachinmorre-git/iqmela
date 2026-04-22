import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CandidateOfferClient } from "./CandidateOfferClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Offer from RelyOnAI",
};

export default async function CandidateOfferPage({ params }: { params: { token: string } }) {
  const { token } = params;

  // Retrieve the frozen/approved offer using the unique candidate token
  const offer = await prisma.jobOffer.findUnique({
    where: { candidateToken: token },
    include: {
      organization: true,
      position: true,
      resume: true,
      template: true,
    },
  });

  if (!offer) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full mx-auto flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Offer Unavailable</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This offer link is either invalid, has expired, or the offer has been revoked by the organization.
          </p>
        </div>
      </div>
    );
  }

  // Ensure the offer is actually released
  if (offer.status === "DRAFT" || offer.status === "PENDING_APPROVAL") {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg border border-gray-100 p-10 text-center">
             <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full mx-auto flex items-center justify-center mb-6">
               <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
             </div>
             <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Processing</h1>
             <p className="text-gray-500 text-sm leading-relaxed">
               Your offer is currently finishing internal approvals. Please check back shortly.
             </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      {/* 
        Pass serializable data to the interactive client.
      */}
      <CandidateOfferClient offer={JSON.parse(JSON.stringify(offer))} token={token} />
    </div>
  );
}
