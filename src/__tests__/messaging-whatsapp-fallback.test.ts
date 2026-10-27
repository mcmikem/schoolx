"use client";
import * as fs from "node:fs";
import * as path from "node:path";

// WhatsApp sends used to run the Cloud API call straight in the browser --
// where the access token cannot exist -- so the channel people were steered
// to ("Auto" prefers it) failed on every send. The composer now hands out
// wa.me rows with the text typed instead.

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("messages: WhatsApp-first composer", () => {
  it("never calls the Cloud API from the browser", () => {
    const page = read("src/app/dashboard/messages/page.tsx");
    expect(page).not.toContain("sendWhatsAppTextMessage(");
    expect(page).toContain("isWhatsAppConfigured");
  });

  it("falls back to the share-link composer rows", () => {
    const page = read("src/app/dashboard/messages/page.tsx");
    expect(page).toContain('via === "whatsapp-manual"');
    expect(page).toContain("<NotifyParentsModal");
  });

  it("keeps the notice broadcast on the server SMS route", () => {
    // Notice sends mix staff phones and run without a user gesture, so the
    // per-row composer cannot serve them.
    const page = read("src/app/dashboard/messages/page.tsx");
    expect(page).toContain("deliverMessage(allPhones, smsMessage)");
    expect(page).toContain("`entries` guards the notice flow");
  });

  it("logs composer sends in the history the school already reads", () => {
    const page = read("src/app/dashboard/messages/page.tsx");
    expect(page).toContain("recipient_count: entries.filter");
  });
});
