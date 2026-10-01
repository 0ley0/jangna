"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ApiError, getToken, setToken } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "ภาพรวม" },
  { href: "/app/employees", label: "พนักงาน" },
  { href: "/app/branches", label: "สาขา" },
];

// อ่าน token จาก localStorage หลัง hydrate เท่านั้น (server render = ยังไม่รู้)
const subscribe = () => () => {};
const useHasToken = () =>
  useSyncExternalStore(subscribe, () => !!getToken(), () => null);

export default function AppLayout({ children }: LayoutProps<"/app">) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const hasToken = useHasToken();
  const me = useMe();

  const unauthorized = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (hasToken === false || unauthorized) router.replace("/login");
  }, [hasToken, unauthorized, router]);

  if (!hasToken) return null;

  const logout = () => {
    setToken(null);
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" className="text-lg font-bold text-primary">
            จ้างนะ
          </Link>
          <nav className="flex gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  pathname === item.href && "bg-muted font-medium text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{me.data?.tenantName}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
