import type { Metadata } from "next";
import { Suspense } from "react";
import { Jost } from "next/font/google";
import Header from "@/components/Header";
import { getProfile } from "@/lib/profile";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "MOA Management",
  description: "Michael Office of Architecture – management app",
};

async function HeaderWithUser() {
  const profile = await getProfile();
  return <Header profile={profile} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jost.className} flex min-h-screen flex-col antialiased`}>
        <Suspense fallback={<Header profile={null} />}>
          <HeaderWithUser />
        </Suspense>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
