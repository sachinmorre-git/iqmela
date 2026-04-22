"use client";

import { useState, useTransition } from "react";
import { deployClientSandbox } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Rocket } from "lucide-react";

export function ClientSandboxDeployer() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message: string }>({
    type: "idle",
    message: "",
  });

  async function handleDeploy(formData: FormData) {
    setStatus({ type: "idle", message: "" });
    const orgName = formData.get("orgName") as string;
    const adminEmail = formData.get("adminEmail") as string;

    if (!orgName || !adminEmail) {
      setStatus({ type: "error", message: "Missing required fields." });
      return;
    }

    startTransition(async () => {
      const result = await deployClientSandbox(orgName, adminEmail);
      if (result.success) {
        setStatus({ type: "success", message: result.message! });
      } else {
        setStatus({ type: "error", message: result.error! });
      }
    });
  }

  return (
    <Card className="bg-zinc-900/50 border-purple-900/40 backdrop-blur-sm max-w-xl">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Rocket className="w-5 h-5 text-purple-500" /> Deploy New Sandbox
        </CardTitle>
        <p className="text-xs text-zinc-400 mt-1">
          Automatically initializes a closed B2B tenant namespace and emails cryptographic admin access.
        </p>
      </CardHeader>
      
      <form action={handleDeploy}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Client Company Name</label>
            <Input 
              name="orgName" 
              required 
              placeholder="e.g. Tesla Corporation" 
              className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Primary Client Admin Email</label>
            <Input 
              name="adminEmail" 
              type="email" 
              required 
              placeholder="elon@tesla.com" 
              className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
            />
          </div>

          {status.type !== "idle" && (
            <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${status.type === 'error' ? 'bg-rose-950/30 text-rose-400 border border-rose-900/50' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50'}`}>
               {status.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 mt-0.5" />}
               <p>{status.message}</p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-zinc-950/50 p-6 border-t border-zinc-800/60 mt-4 rounded-b-xl">
          <Button 
            disabled={isPending} 
            type="submit" 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isPending ? "Deploying Sandbox..." : "Programmatically Deploy Sandbox"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
