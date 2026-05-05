import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ShieldCheck, Video, Mic } from "lucide-react"

export const metadata = {
  title: "Candidate Lobby | IQMela",
  description: "Secure, credential-less entry for your AI interview.",
}

export default async function MagicLinkLobby({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  // Step 316: Validate token server-side
  const session = await prisma.aiInterviewSession.findUnique({
    where: { magicLinkToken: token },
    include: {
      position: { select: { title: true, organizationId: true } },
      candidate: { select: { name: true, email: true } }
    }
  });

  if (!session) {
    return (
      <div className="flex-1 w-full min-h-[100vh] flex items-center justify-center bg-[#0A0A0A] p-4 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-black">!</div>
          <h1 className="text-2xl font-black text-white mb-2">Link Invalid or Expired</h1>
          <p className="text-zinc-400 mb-6">This magic link does not match any active interview. Please contact your recruiter.</p>
        </div>
      </div>
    );
  }

  if (session.status === "COMPLETED") {
    return (
      <div className="flex-1 w-full min-h-[100vh] flex items-center justify-center bg-[#0A0A0A] p-4 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <CheckCircle2 className="w-16 h-16 text-rose-400 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white mb-2">Interview Completed</h1>
          <p className="text-zinc-400 mb-6">You have already completed this session. Your recruiter will be in touch shortly.</p>
        </div>
      </div>
    );
  }

  // The Active Lobby
  return (
    <div className="flex flex-col min-h-[100vh] items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[2rem] shadow-2xl overflow-hidden shadow-rose-500/5">
        
        <div className="p-8 sm:p-12 text-center border-b border-zinc-800 bg-zinc-900/50">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            <ShieldCheck className="w-4 h-4" /> Secure Zero-Auth Entry
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Welcome, {session.candidate?.name?.split(' ')[0] || "Candidate"}!
          </h1>
          <p className="text-zinc-400 font-medium">
            You are checking in for the <span className="text-zinc-200">{session.position?.title}</span> AI interview.
          </p>
        </div>

        <div className="p-8 sm:p-12 space-y-8 bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 text-zinc-300 rounded-full flex items-center justify-center shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-100">Camera Check</p>
                <p className="text-xs text-zinc-500">Ensure good lighting.</p>
              </div>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 text-zinc-300 rounded-full flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-100">Mic Check</p>
                <p className="text-xs text-zinc-500">Quiet environment required.</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-sm text-blue-200">
            <strong>Consent & Security:</strong> By continuing, you agree to have this AI interview session recorded and analyzed to assist the hiring team. You do not need to create an account or set a password.
          </div>

          {/* Navigates directly into the live AI interview via token context */}
          <Link href={`/interview/magic/${token}/live`} className="block w-full">
            <Button size="lg" className="w-full h-14 bg-white hover:bg-zinc-200 text-black font-bold text-lg rounded-2xl transition-all shadow-lg shadow-white/10 hover:shadow-white/20">
              Agree & Start Interview
            </Button>
          </Link>
        </div>
        
      </div>
    </div>
  );
}
