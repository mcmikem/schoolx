import { render } from "@testing-library/react";
import { Input, Select, Textarea } from "@/components/ui";
import { Tabs, TabPanel } from "@/components/ui/Tabs";

describe("a11y contracts", () => {
  test("Input propagates aria-required and aria-invalid", () => {
    const { container } = render(<Input label="Name" required error="Required" value="" onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toMatch(/-error/);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });

  test("Tabs aria-controls matches panel id pattern", () => {
    const tabs = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const { getByRole } = render(<Tabs tabs={tabs} activeTab="a" onChange={() => {}} />);
    const tabA = getByRole("tab", { name: "A" });
    const controls = tabA.getAttribute("aria-controls") || "";
    expect(controls).toMatch(/^panel-.*-a$/);
    expect(tabA.getAttribute("aria-selected")).toBe("true");
    expect(tabA.id).toMatch(/^tab-.*-a$/);
  });

  test("darkMode selector uses data-theme", () => {
    // tailwind.config darkMode should be selector on [data-theme="dark"]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cfg = require("../../tailwind.config.js");
    expect(cfg.darkMode).toEqual(["selector", '[data-theme="dark"]']);
  });
});
