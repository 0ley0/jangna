import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium text-primary">Jangna</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">จ้างนะ</h1>
        <p className="text-xl text-muted-foreground">จ้างง่าย จ่ายถูก — ลงเวลา ค่าแพ็ค และเงินเดือน จบใน LINE</p>
      </div>
      <ul className="grid gap-2 text-muted-foreground sm:grid-cols-3">
        <li className="rounded-lg border p-4">พนักงานลงเวลาผ่าน LINE ไม่ต้องลงแอป</li>
        <li className="rounded-lg border p-4">แพ็คปุ๊บ นับปั๊บ คิดค่าแพ็คต่อชิ้นให้อัตโนมัติ</li>
        <li className="rounded-lg border p-4">ประกันสังคม ภาษี สลิปเงินเดือน ครบ</li>
      </ul>
      <div className="flex gap-3">
        <Link href="/register" className={buttonVariants({ size: "lg" })}>
          เริ่มใช้ฟรี
        </Link>
        <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
          เข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}
