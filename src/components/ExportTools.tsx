"use client";

interface ExportToolsProps {
  data: any[];
  filename: string;
  columns?: { key: string; label: string }[];
}

export default function ExportTools({
  data,
  filename,
  columns,
}: ExportToolsProps) {
  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    const keys = columns ? columns.map((c) => c.key) : Object.keys(data[0]);
    const headers = columns ? columns.map((c) => c.label) : keys;

    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        keys
          .map((key) => {
            const value = row[key];
            if (value === null || value === undefined) return "";
            if (
              typeof value === "string" &&
              (value.includes(",") ||
                value.includes('"') ||
                value.includes("\n"))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    if (!data || data.length === 0) return;

    const keys = columns ? columns.map((c) => c.key) : Object.keys(data[0]);
    const headers = columns ? columns.map((c) => c.label) : keys;
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(filename)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 10px; }
          .date { color: #666; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(filename)}</h1>
        <p class="date">Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (row, i) => `
              <tr>
                <td>${i + 1}</td>
                ${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!data || data.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={exportToCSV}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
          minHeight: 40,
        }}
        title="Export to CSV"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          download
        </span>
        Export CSV
      </button>
      <button
        onClick={printTable}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
          minHeight: 40,
        }}
        title="Print"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          print
        </span>
        Print
      </button>
    </div>
  );
}
