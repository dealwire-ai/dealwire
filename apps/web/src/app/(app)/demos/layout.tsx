import { currentUser } from "@clerk/nextjs/server";
import { isInternalUser } from "@/lib/utils";

export default async function DemosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!isInternalUser(email)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-white">Access Denied</h1>
          <p className="text-sm text-zinc-500">
            Demos are only available to internal users.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
