import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { DeploymentWatcher } from "@/components/DeploymentWatcher";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "QuatHub — коммерческие сметы в энергетике",
  description:
    "Портал товаров, услуг и коммерческих смет для электроснабжения Казахстана",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${sans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--page)] text-[var(--text-primary)] antialiased">
        <ToastProvider>
          {children}
          <SiteFooter />
          <DeploymentWatcher />
        </ToastProvider>
      </body>
    </html>
  );
}
