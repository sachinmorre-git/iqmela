import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: 'My Profile | Interview Platform',
  description: 'Manage your candidate details.',
}

export default function CandidateProfile() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Candidate Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">Update your personal details and professional background.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
        <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
           <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label htmlFor="fullname" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
                 <input id="fullname" type="text" placeholder="Jane Doe" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400" />
               </div>
               
               <div className="space-y-2">
                 <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                 <input id="email" type="email" placeholder="jane@company.com" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400" />
               </div>

               <div className="space-y-2">
                 <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Phone Number</label>
                 <input id="phone" type="tel" placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400" />
               </div>

               <div className="space-y-2">
                 <label htmlFor="timezone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Timezone</label>
                 {/* Wrapper for custom select arrow */}
                 <div className="relative">
                   <select id="timezone" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white appearance-none pr-10">
                      <option value="">Select a timezone...</option>
                      <option value="PST">Pacific Time (PT)</option>
                      <option value="EST">Eastern Time (ET)</option>
                      <option value="UTC">Coordinated Universal Time (UTC)</option>
                      <option value="CET">Central European Time (CET)</option>
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                     <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                   </div>
                 </div>
               </div>
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 pt-8 mt-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Professional Details</h3>

              <div className="space-y-6">
                <div className="space-y-2">
                   <label htmlFor="skills" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Key Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
                   <input id="skills" type="text" placeholder="React, Node.js, Python, System Design" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400" />
                </div>

                <div className="space-y-2">
                   <label htmlFor="resume" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Resume URL</label>
                   <input id="resume" type="url" placeholder="https://linkedin.com/in/janedoe or Portfolio URL" className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400" />
                </div>

                <div className="space-y-2">
                   <label htmlFor="experience" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Experience Summary</label>
                   <textarea id="experience" rows={4} placeholder="Briefly describe your background, years of experience, and biggest achievements..." className="w-full px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white placeholder:text-gray-400 resize-none"></textarea>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-zinc-800 mt-8">
               <Button type="button" className="px-10 py-5 rounded-xl shadow-lg font-bold">
                 Save Profile
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
