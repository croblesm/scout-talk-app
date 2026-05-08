import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'TalkScout',
  description: 'Find dev conferences worth submitting your next talk to.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans dark", geist.variable)} style={{ colorScheme: "dark" }}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(79,70,229,0.12),transparent_50%)]" />
        {children}
      </body>
    </html>
  )
}
