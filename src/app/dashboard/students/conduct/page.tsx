"use client";

import { Card, CardBody } from "@/components/ui/Card";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ConductManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Conduct & Merits"
        subtitle="This module is temporarily unavailable while production hardening is completed."
      />
      <Card>
        <CardBody className="py-12 text-center text-[var(--t3)]">
          <MaterialIcon icon="hourglass_top" className="text-4xl mb-3" />
          <p>Please use core student, attendance, and reports workflows for now.</p>
        </CardBody>
      </Card>
    </div>
  );
}
