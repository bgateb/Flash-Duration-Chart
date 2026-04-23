import Link from "next/link";
import { listAllWithReadings } from "@/lib/queries";
import { FlashChartView } from "@/components/FlashChartView";

export const dynamic = "force-dynamic";

export default async function Home() {
  let flashes: Awaited<ReturnType<typeof listAllWithReadings>> = [];
  let loadError: string | null = null;
  try {
    flashes = await listAllWithReadings();
  } catch (err: any) {
    loadError = err?.message ?? "Failed to load data";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Flash Duration Chart</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Measured <span className="font-medium text-foreground">t0.1</span> flash duration across power settings for
            every flash unit I&rsquo;ve tested, and some readings I've collected from around the web. Toggle flashes on and off, 
            switch the X-axis between fractional power and stops below full, and hover any point for the precise reading.<br><br>
            for more information about the methodology, please read the <a href ="https://www.bgateb.com/blog/2017/04/14/2017-4-13-flash-duration-analysis-with-the-sekonic-l858d-u">original blog post.</a>
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          admin
        </Link>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-medium">Could not load data.</p>
          <p className="mt-1 font-mono text-xs opacity-80">{loadError}</p>
          <p className="mt-2 text-xs">
            Check that MySQL is reachable and that <code>db/schema.sql</code> has been run against the database.
          </p>
        </div>
      ) : flashes.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No flashes yet. <Link href="/admin" className="font-medium text-foreground underline">Add your first flash</Link> to see it on the chart.
        </div>
      ) : (
        <FlashChartView flashes={flashes} />
      )}
    </main>
  );
}
