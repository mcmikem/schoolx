"use client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";

interface ClassItem {
  id: string;
  name: string;
}

interface MessageComposerProps {
  messageType: "individual" | "class" | "all";
  onMessageTypeChange: (type: "individual" | "class" | "all") => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  selectedClass: string;
  onSelectedClassChange: (cls: string) => void;
  classes: ClassItem[];
  message: string;
  onMessageChange: (msg: string) => void;
  sending: boolean;
  onSend: () => void;
}

const messageTypeTabs = [
  { id: "individual", label: "One Parent" },
  { id: "class", label: "By Class" },
  { id: "all", label: "All Parents" },
];

export default function MessageComposer({
  messageType,
  onMessageTypeChange,
  phone,
  onPhoneChange,
  selectedClass,
  onSelectedClassChange,
  classes,
  message,
  onMessageChange,
  sending,
  onSend,
}: MessageComposerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Message</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <Tabs
          tabs={messageTypeTabs}
          activeTab={messageType}
          onChange={(id) =>
            onMessageTypeChange(id as "individual" | "class" | "all")
          }
        />
        {messageType === "individual" && (
          <div>
            <label
              htmlFor="message-phone"
              className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
            >
              Phone Number
            </label>
            <input
              id="message-phone"
              type="tel"
              placeholder="0700000000"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
            />
          </div>
        )}
        {messageType === "class" && (
          <div>
            <label
              htmlFor="message-class"
              className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
            >
              Select Class
            </label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                No classes available
              </div>
            ) : (
              <select
                id="message-class"
                value={selectedClass}
                onChange={(e) => onSelectedClassChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
              >
                <option value="">Choose class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div>
          <label
            htmlFor="message-body"
            className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
          >
            Message
          </label>
          <textarea
            id="message-body"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Type your message here..."
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors min-h-[120px] resize-none"
            maxLength={160}
          />
          <p className="text-xs text-[var(--t3)] mt-2">
            {message.length}/160 characters
          </p>
        </div>
        <Button
          onClick={onSend}
          disabled={sending || !message.trim()}
          loading={sending}
        >
          <MaterialIcon icon="send" className="text-lg" />
          {sending ? "Sending..." : "Send SMS"}
        </Button>
      </CardBody>
    </Card>
  );
}
