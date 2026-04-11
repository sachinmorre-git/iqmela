import { Card, CardTitle, CardContent } from "@/components/ui/card"
import { RoleCards } from "./RoleCards"

export const metadata = {
  title: 'Select Role | Interview Platform',
  description: 'Choose your role to continue.',
}

export default function SelectRolePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[75vh] py-16 px-4 w-full">
      <div className="w-full max-w-3xl text-center mb-12">
        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">How do you want to use the platform?</h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">Select your primary role to customize your dashboard experience.</p>
      </div>
      
      <RoleCards />

    </div>
  )
}
