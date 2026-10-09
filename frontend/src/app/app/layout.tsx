import type { Metadata } from "next";
import { AppHeader } from "@/components/workspace/app-header";
import { HeaderActions } from "@/components/workspace/header-actions";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader>
        <HeaderActions />
      </AppHeader>
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col focus:outline-none">
        {children}
      </main>
    </>
  );
}
