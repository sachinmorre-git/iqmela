import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <SignIn path="/sign-in" fallbackRedirectUrl="/select-role" />
    </div>
  );
}
