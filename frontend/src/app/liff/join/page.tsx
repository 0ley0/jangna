import { Suspense } from "react";
import { JoinFlow } from "./join-flow";

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p className="text-center text-muted-foreground">กำลังโหลด…</p>}>
          <JoinFlow />
        </Suspense>
      </div>
    </main>
  );
}
