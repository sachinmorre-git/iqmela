import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <SignUp path="/sign-up" fallbackRedirectUrl="/select-role" />
    </div>
  );
}
