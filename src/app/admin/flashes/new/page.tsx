import { FlashForm } from "@/components/admin/FlashForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function NewFlashPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Add flash</CardTitle>
        </CardHeader>
        <CardContent>
          <FlashForm />
        </CardContent>
      </Card>
    </div>
  );
}
