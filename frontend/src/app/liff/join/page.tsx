import { Suspense } from "react";
import { LangToggle } from "@/components/lang-toggle";
import { JoinFlow } from "./join-flow";

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-3">
        <LangToggle className="justify-self-end" />
        <Suspense fallback={<p className="text-center text-muted-foreground">…</p>}>
          <JoinFlow />
        </Suspense>
      </div>
    </main>
  );
}
