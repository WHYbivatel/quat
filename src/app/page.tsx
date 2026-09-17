import { redirect } from "next/navigation";

/** Главная ведёт сразу в рабочую область каталог + смета */
export default function HomePage() {
  redirect("/catalog/products");
}
