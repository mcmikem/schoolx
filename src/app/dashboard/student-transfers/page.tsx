"use client";

import { Card, CardBody } from "@/components/ui/Card";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StudentTransfersPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Student Transfers"
        subtitle="This workflow is temporarily unavailable while it is being hardened for production."
      />
      <Card>
        <CardBody className="py-12 text-center text-[var(--t3)]">
          <MaterialIcon icon="hourglass_top" className="text-4xl mb-3" />
          <p>Please process transfer requests through approved admin channels for now.</p>
        </CardBody>
      </Card>
    </div>
  );
}
