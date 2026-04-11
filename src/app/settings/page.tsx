'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')

  return (
    <div className="flex flex-1 flex-col items-center min-h-[85vh] py-16 px-4 w-full">
      <div className="w-full max-w-5xl">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Global Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">Manage your account parameters, notifications, and security.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide">
            <button 
              onClick={() => setActiveTab('account')}
              className={`px-5 py-3.5 text-sm sm:text-base text-left rounded-xl whitespace-nowrap transition-all duration-200 ${
                activeTab === 'account' 
                ? 'bg-indigo-50 dark:bg-zinc-900 bg-opacity-80 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 font-medium'
              }`}
            >
              Account
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`px-5 py-3.5 text-sm sm:text-base text-left rounded-xl whitespace-nowrap transition-all duration-200 ${
                activeTab === 'notifications' 
                ? 'bg-indigo-50 dark:bg-zinc-900 bg-opacity-80 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 font-medium'
              }`}
            >
              Notifications
            </button>
            <button 
              onClick={() => setActiveTab('devices')}
              className={`px-5 py-3.5 text-sm sm:text-base text-left rounded-xl whitespace-nowrap transition-all duration-200 ${
                activeTab === 'devices' 
                ? 'bg-indigo-50 dark:bg-zinc-900 bg-opacity-80 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 font-medium'
              }`}
            >
              Devices & Security
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 w-full">
            {activeTab === 'account' && (
              <Card className="shadow-sm border-gray-100 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
                   <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Account Configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4 border-b border-gray-100 dark:border-zinc-800 pb-8">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Email Address</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Update the core email associated with your platform identity.</p>
                      <input type="email" placeholder="user@domain.com" className="w-full max-w-md px-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                    </div>
                  </div>
                  <div className="space-y-4 border-b border-gray-100 dark:border-zinc-800 pb-8 pt-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Update Password</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ensure your account is using a long, random password.</p>
                      <Button variant="outline" className="border-gray-200 dark:border-zinc-800 bg-white dark:bg-transparent">Change Password</Button>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div>
                      <h4 className="text-sm font-bold text-red-600 mb-1">Danger Zone</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Permanently delete your account and easily wipe all contained data.</p>
                      <Button variant="outline" className="border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Delete Account</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="shadow-sm border-gray-100 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
                   <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Inbox & Alerts</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-5 border border-gray-100 dark:border-zinc-800 rounded-2xl hover:border-gray-200 dark:hover:border-zinc-700 transition">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white mb-0.5">Email Digests</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 w-[80%]">Receive a comprehensive weekly summary of your recent interactions.</p>
                    </div>
                    {/* Mock Toggle - Active */}
                    <div className="w-12 h-6 bg-indigo-600 rounded-full flex items-center px-1 justify-end cursor-pointer shrink-0 transition-opacity hover:opacity-80">
                      <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-5 border border-gray-100 dark:border-zinc-800 rounded-2xl hover:border-gray-200 dark:hover:border-zinc-700 transition">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white mb-0.5">Push Notifications</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 w-[80%]">Real-time alerts for scheduled appointments right to your browser.</p>
                    </div>
                    {/* Mock Toggle - Inactive */}
                    <div className="w-12 h-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center px-1 justify-start cursor-pointer shrink-0 transition-opacity hover:opacity-80">
                      <div className="w-4 h-4 bg-white dark:bg-gray-400 rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'devices' && (
              <Card className="shadow-sm border-gray-100 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
                   <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Active Sessions</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-5 p-5 border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800 shadow-sm flex items-center justify-center shrink-0 text-indigo-600">
                       <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                         <h4 className="text-base font-bold text-gray-900 dark:text-white">MacBook Pro 16&quot;</h4>
                         <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md shrink-0">Current Session</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Chrome • San Francisco, USA • Active right now</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-5 p-5 border border-gray-100 dark:border-zinc-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-center shrink-0 text-gray-500">
                       <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">iPhone 14 Pro Max</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Safari • New York, USA • Last seen 2 hrs ago</p>
                    </div>
                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold px-4">Revoke</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
