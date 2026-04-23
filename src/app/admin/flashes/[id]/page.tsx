import { notFound } from "next/navigation";
import Link from "next/link";
import { getFlash, listReadings } from "@/lib/queries";
import { FlashForm } from "@/components/admin/FlashForm";
import { ReadingsEditor } from "@/components/admin/ReadingsEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FlashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const flash = await getFlash(n);
  if (!flash) notFound();
  const readings = await listReadings(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← back to flashes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {flash.manufacturer} {flash.model}
          </h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Flash details</CardTitle>
          </CardHeader>
          <CardContent>
            <FlashForm initial={flash} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Readings · {readings.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadingsEditor flashId={flash.id} initial={readings} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
