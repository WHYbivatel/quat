import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "credentials";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Вход в QuatHub</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Демо: buyer@demo.quathub.local / Demo1234!
      </p>

      <form action={loginAction} className="mt-8 flex flex-col gap-4">
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
    </main>
  );
}
