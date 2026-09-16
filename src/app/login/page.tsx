import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/lib/auth";
import { safeReturnTo } from "@/lib/safe-url";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeReturnTo(String(formData.get("next") ?? ""), "/app");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: next,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
}

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "credentials";
  const next = safeReturnTo(params.next, "/app");
  const session = await auth();

  if (session?.user) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
          QuatHub
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl">
          Вы уже вошли
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{session.user.email}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={next}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Продолжить
          </Link>
          <Link href="/catalog/products" className="text-center text-sm underline">
            В каталог
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full text-sm text-[var(--muted)] underline">
              Выйти / сменить аккаунт
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
        QuatHub — на главную
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl">
        Вход в QuatHub
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Демо: buyer@demo.quathub.local / Demo1234!
      </p>

      <form action={loginAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2"
            defaultValue="buyer@demo.quathub.local"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Пароль
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2"
            defaultValue="Demo1234!"
          />
        </label>
        {hasError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            Неверный email или пароль.
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Войти
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/catalog/products" className="underline text-[var(--accent)]">
          В каталог без входа
        </Link>
      </p>
    </main>
  );
}
