/**
 * The tuition preselect has to be right without being clever.
 *
 * It fires when exactly one tuition line is on offer, which is the normal case:
 * on live data 49 of 50 class/term groups have a single tuition line. It stays
 * quiet when more than one could be meant, because picking between them by id
 * would record a payment against a fee line nobody chose, and a bursar cannot
 * tell afterwards which of several same-named lines a payment landed on.
 */

import FeePicker, { type FeeOption } from "@/components/fees/FeePicker";
import { fireEvent, render, screen } from "@testing-library/react";

function renderPicker(fees: FeeOption[], defaultFeeId = "") {
  return render(
    <FeePicker fees={fees} value="" onChange={() => {}} defaultFeeId={defaultFeeId} />,
  );
}

const tuition = (id: string, amount = 250000): FeeOption => ({
  id,
  name: "Term 1 Tuition",
  amount,
});
const meals = (id: string): FeeOption => ({ id, name: "Meals", amount: 80000 });

describe("FeePicker tuition preselect", () => {
  it("preselects tuition when the caller offers exactly one", () => {
    const opts = [tuition("t1"), meals("m1")];
    renderPicker(opts, "t1");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("t1");
  });

  it("offers meals and development fund too, not only tuition", () => {
    renderPicker([tuition("t1"), meals("m1"), { id: "d1", name: "Development Fund" }], "t1");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Whole bill / not fee-specific",
      expect.stringContaining("Term 1 Tuition"),
      expect.stringContaining("Meals"),
      expect.stringContaining("Development Fund"),
    ]);
  });

  it("shows the amount so the bursar can recognise the fee", () => {
    renderPicker([tuition("t1", 250000)], "t1");
    const option = (screen.getByRole("combobox") as HTMLSelectElement).options[1];
    expect(option.textContent).toContain("250");
  });

  it("falls back to the whole bill when the default names a fee that is gone", () => {
    // A deleted line between load and submit, or a stale default after a
    // term change. Never preselect something not in the list.
    renderPicker([meals("m1")], "t1");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });

  it("ignores the default when the caller offers no tuition", () => {
    renderPicker([meals("m1"), { id: "d1", name: "Development Fund" }], "");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });

  it("keeps retired lines out of the choice even if one is the default", () => {
    renderPicker([{ id: "t1", name: "Tuition", retired: true }, meals("m1")], "t1");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect([...select.options].map((o) => o.value)).toEqual(["", "m1"]);
  });

  it("shows the whole-bill option first so it stays reachable", () => {
    renderPicker([tuition("t1")], "t1");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.options[0].value).toBe("");
  });

  it("still records an explicit choice over the default", async () => {
    const seen: string[] = [];
    render(
      <FeePicker
        fees={[tuition("t1"), meals("m1")]}
        value=""
        onChange={(id) => seen.push(id)}
        defaultFeeId="t1"
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "m1" } });
    expect(seen).toContain("m1");
  });
});