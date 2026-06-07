import { LayoutGrid } from "lucide-react";

// SC-WP-01 C3 — 빈 셸 placeholder.
// 사이드바 3탭(도서관·개인스페이스·채팅) 실제 화면은 후속 WP-02~05.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-neutral-700">
      <LayoutGrid className="h-8 w-8" aria-hidden />
      <h1 className="text-lg font-semibold">sc_demo</h1>
      <p className="text-sm text-neutral-500">frontend skeleton — WP-01 C3</p>
    </main>
  );
}
