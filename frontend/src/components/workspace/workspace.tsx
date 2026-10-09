"use client";

import * as React from "react";
import { Library, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useChats } from "@/stores/chats";
import { useEvidence } from "@/stores/evidence";
import { useLibrary } from "@/stores/library";
import { useUi } from "@/stores/ui";
import { ChatSwitcher } from "./conversation/chat-switcher";
import { ConversationPane } from "./conversation/conversation-pane";
import { EvidencePanel } from "./evidence/evidence-panel";
import { DocumentDrawer } from "./library/document-drawer";
import { LibraryPanel } from "./library/library-panel";
import { Pane } from "./pane";
import { PdfSheet } from "./pdf/pdf-sheet";

/**
 * Three panes from 1280px (library, conversation, evidence); from 1024px the
 * library moves into a sheet; below that the evidence does too.
 */
export function Workspace() {
  const librarySheet = useUi((s) => s.librarySheet);
  const setLibrarySheet = useUi((s) => s.setLibrarySheet);
  const evidenceSheet = useEvidence((s) => s.sheetOpen);
  const setEvidenceSheet = useEvidence((s) => s.setSheetOpen);
  const docCount = useLibrary((s) => s.documents.length);
  const selectedCount = useLibrary((s) => s.selectedIds.length);

  React.useEffect(() => {
    void useLibrary.getState().load();
    void useChats.getState().load();
  }, []);

  return (
    <TooltipProvider>
      <div className="grid h-[calc(100dvh-var(--header-h,56px))] min-h-[480px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:grid-cols-[300px_minmax(0,1fr)_minmax(360px,420px)]">
        <Pane
          label="Library"
          className="hidden border-r border-line xl:flex"
          heading={<h2 className="m-0 text-sm font-semibold">Library</h2>}
          meta={<span className="font-mono text-xs text-ink-subtle tabular">{docCount}</span>}
        >
          <LibraryPanel idPrefix="pane" />
        </Pane>

        <ConversationPane
          toolbar={
            <>
              <ChatSwitcher />
              <span aria-hidden className="flex-1" />
              <Button variant="outline" size="sm" className="xl:hidden" onClick={() => setLibrarySheet(true)}>
                <Library /> Library <span className="font-mono text-ink-subtle tabular">{selectedCount}/{docCount}</span>
              </Button>
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setEvidenceSheet(true)}>
                <PanelRight /> Evidence
              </Button>
            </>
          }
        />

        <Pane label="Evidence" className="hidden border-l border-line lg:flex" heading={<h2 className="m-0 text-sm font-semibold">Evidence</h2>}>
          <EvidencePanel />
        </Pane>
      </div>

      <Sheet open={librarySheet} onOpenChange={setLibrarySheet} side="left" title="Library" description="Upload documents and choose which ones to ask about." hideDescription width={380}>
        <LibraryPanel idPrefix="sheet" />
      </Sheet>
      <Sheet open={evidenceSheet} onOpenChange={setEvidenceSheet} side="bottom" title="Evidence" description="Passages the answer was written from." hideDescription>
        <EvidencePanel />
      </Sheet>
      <DocumentDrawer />
      <PdfSheet />
    </TooltipProvider>
  );
}
