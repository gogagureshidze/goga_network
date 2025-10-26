import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="h-[calc(100vh-96px)] dark:bg-grey-900 flex items-center justify-center">
      <SignIn />
    </div>
  );
}
