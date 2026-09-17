import { redirect } from "next/navigation";

/** Черновик гостя перенесён в панель сметы на экране каталога */
export default function GuestDraftPage() {
  redirect("/catalog/products");
}
