import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { useFeeTemplateImport, type FeeCreateInput } from "@/lib/hooks/useFeeTemplateImport";
import type { FeeStructure } from "@/types";

const CLASSES = [
  { id: "c1", name: "P.1" },
  { id: "c2", name: "P.2" },
];

const HEADER = "Fee Name,Class,Amount (UGX),Term,Category,Applies To,Frequency\n";

interface Summary {
  success: number;
  failed: number;
  skipped: number;
  total: number;
  errors: string[];
}

async function seed(hook: ReturnType<typeof useFeeTemplateImport>): Promise<Summary | null> {
  let summary: Summary | null = null;
  await act(async () => {
    summary = (await hook.handleSeedFeesFromTemplate()) as Summary | null;
  });
  return summary;
}

function upload(hook: ReturnType<typeof useFeeTemplateImport>, csv: string) {
  const file = new File([csv], "fees.csv", { type: "text/csv" });
  return act(async () => {
    await hook.handleFeeTemplateUpload({ target: { files: [file] } } as unknown as ChangeEvent<HTMLInputElement>);
  });
}

function setup(overrides: Partial<Parameters<typeof useFeeTemplateImport>[0]> = {}) {
  const createFeeStructure = jest.fn(async (_fee: FeeCreateInput) => ({})) as unknown as jest.Mock;
  const hook = renderHook(() =>
    useFeeTemplateImport({
      classes: CLASSES,
      academicYear: "2026",
      defaultTerm: 2,
      existingFees: [],
      createFeeStructure,
      ...overrides,
    }),
  );
  return { hook, createFeeStructure };
}

describe("useFeeTemplateImport", () => {
  it("parses rows, resolves classes and previews them", async () => {
    const { hook } = setup();
    await upload(
      hook.result.current,
      HEADER + "Tuition,P.1,500000,Term 1,Tuition,Day,Per Term\nDevelopment,,20000,,,All,One-off\n",
    );

    expect(hook.result.current.templateStatus).toBe("ready");
    expect(hook.result.current.templateRows).toHaveLength(2);
    expect(hook.result.current.templateRows[0].preview.resolved_class).toBe("P.1");
    expect(hook.result.current.templateRows[1].preview.resolved_class).toBe("All classes");
    expect(hook.result.current.templateRows[1].term).toBeNull();
  });

  it("seeds each row through createFeeStructure with normalised values", async () => {
    const { hook, createFeeStructure } = setup();
    await upload(hook.result.current, HEADER + "Tuition,P.1,500000,Term 1,Tuition,Day,Per Term\n");

    const summary = await seed(hook.result.current);

    expect(summary?.success).toBe(1);
    expect(createFeeStructure).toHaveBeenCalledTimes(1);
    expect(createFeeStructure.mock.calls[0][0]).toMatchObject({
      name: "Tuition",
      class_id: "c1",
      amount: 500000,
      term: 1,
      academic_year: "2026",
      category: "tuition",
      boarding_status: "day",
      frequency: "per_term",
    });
  });

  it("defaults a missing term to the term being set up", async () => {
    const { hook, createFeeStructure } = setup({ defaultTerm: 3 });
    await upload(hook.result.current, HEADER + "Tuition,P.1,500000,,Tuition,Day,Per Term\n");
    await act(async () => {
      await hook.result.current.handleSeedFeesFromTemplate();
    });
    expect(createFeeStructure.mock.calls[0][0]).toMatchObject({ term: 3 });
  });

  it("uses the fallback class for rows with no Class column", async () => {
    const { hook, createFeeStructure } = setup({ fallbackClassId: "c2" });
    await upload(hook.result.current, HEADER + "Development,,20000,,,All,One-off\n");
    await act(async () => {
      await hook.result.current.handleSeedFeesFromTemplate();
    });
    expect(createFeeStructure.mock.calls[0][0]).toMatchObject({ class_id: "c2", term: null });
  });

  it("skips fees already on the live list", async () => {
    const existing = [{ name: "Tuition", class_id: "c1", term: 1, academic_year: "2026" }] as unknown as FeeStructure[];
    const { hook, createFeeStructure } = setup({ existingFees: existing });
    await upload(hook.result.current, HEADER + "Tuition,P.1,500000,Term 1,Tuition,Day,Per Term\n");

    const summary = await seed(hook.result.current);

    expect(summary?.skipped).toBe(1);
    expect(summary?.success).toBe(0);
    expect(createFeeStructure).not.toHaveBeenCalled();
  });

  it("counts a duplicate error as skipped, not failed", async () => {
    const { hook, createFeeStructure } = setup();
    createFeeStructure.mockRejectedValueOnce(
      new Error("A fee structure with the same name, class, term, and academic year already exists"),
    );
    await upload(hook.result.current, HEADER + "Tuition,P.1,500000,Term 1,Tuition,Day,Per Term\n");

    const summary = await seed(hook.result.current);

    expect(summary?.skipped).toBe(1);
    expect(summary?.failed).toBe(0);
  });

  it("drops a row naming a class the school does not have", async () => {
    const { hook } = setup();
    await upload(hook.result.current, HEADER + "Tuition,P.9,500000,Term 1,Tuition,Day,Per Term\n");

    await waitFor(() => expect(hook.result.current.templateStatus).toBe("ready"));
    expect(hook.result.current.templateRows).toHaveLength(0);
    expect(hook.result.current.templateErrors).toContain("no class matches");
  });
});
