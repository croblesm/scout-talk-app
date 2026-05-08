export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="bg-gradient-to-r from-accent to-accent-deep bg-clip-text text-5xl font-bold tracking-tight text-transparent">
        TalkScout
      </h1>
      <p className="max-w-prose text-center text-lg text-zinc-600 dark:text-zinc-400">
        Find the next dev conference worth pitching your talk to.
      </p>
      <p className="text-sm text-zinc-500">Search UI lands at task T013.</p>
    </main>
  )
}
