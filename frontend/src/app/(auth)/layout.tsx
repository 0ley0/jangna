import Link from "next/link";
import { BrandMark } from "@/components/icons";
import { LangToggle } from "@/components/lang-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <LangToggle className="absolute top-4 right-4" />
      <Link href="/" className="flex items-center gap-2.5">
        <BrandMark size={36} />
        <span className="text-2xl font-bold tracking-[-0.015em]">จ้างนะ</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
