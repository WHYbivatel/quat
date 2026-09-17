import Link from "next/link";
import { UiKitClient } from "./UiKitClient";

export default function UiKitPage() {
  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <Link href="/" className="text-sm font-semibold">
          ← QuatHub
        </Link>
      </div>
      <UiKitClient />
    </>
  );
}
