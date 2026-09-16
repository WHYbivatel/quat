import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import { DeploymentWatcher } from "@/components/DeploymentWatcher";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const display = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "QuatHub — коммерческие сметы в энергетике",
  description:
    "Портал товаров, услуг и коммерческих смет для электроснабжения Казахстана",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] antialiased">
        {children}
        <SiteFooter />
        <DeploymentWatcher />
      </body>
    </html>
  );
}
