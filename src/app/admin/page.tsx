import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAllWithReadings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const flashes = await listAllWithReadings();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flashes</h1>
          <p className="text-sm text-muted-foreground">
            {flashes.length} flash{flashes.length === 1 ? "" : "es"} · {" "}
            {flashes.reduce((n, f) => n + f.readings.length, 0)} readings
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/flashes/new">Add flash</Link>
        </Button>
      </div>

      {flashes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No flashes yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Add flash</span> above to start recording readings.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Manufacturer</th>
                <th className="px-4 py-2.5 text-left font-medium">Model</th>
                <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                <th className="px-4 py-2.5 text-right font-medium">Readings</th>
                <th className="px-4 py-2.5 text-left font-medium">Tested</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {flashes.map((f) => (
                <tr key={f.id} className="border-t border-border/60 hover:bg-accent/40">
                  <td className="px-4 py-2.5">{f.manufacturer}</td>
                  <td className="px-4 py-2.5 font-medium">{f.model}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.mode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{f.readings.length}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.tested_on ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/admin/flashes/${f.id}`}>
                      edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
