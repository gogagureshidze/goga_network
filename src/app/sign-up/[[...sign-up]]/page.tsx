import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-[calc(100vh-96px)] flex items-center justify-center bg-rose-50 p-4">
        <SignUp />
      </div>

  );
}
