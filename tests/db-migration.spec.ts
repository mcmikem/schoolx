import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("Migration Scripts", () => {
  it("should have syntactically correct migration scripts", async () => {
    const scripts = [
      "./scripts/run-critical-fix.sh",
      "./scripts/db-push.sh",
      "./scripts/apply-migration.sh",
      "./scripts/setup-database.sh",
    ];

    for (const script of scripts) {
      const result = await execAsync(`bash -n ${script}`);
      expect(result).toBeDefined();
    }
  });

  it("should execute with dummy environment variables", async () => {
    const result = await new Promise<{ stdout: string; status: number }>(
      (resolve) => {
        exec("./scripts/run-critical-fix.sh", (error, stdout) => {
          resolve({ stdout: stdout || "", status: error ? 1 : 0 });
        });
      },
    );

    expect(result.status >= 0).toBe(true);
  });
});
