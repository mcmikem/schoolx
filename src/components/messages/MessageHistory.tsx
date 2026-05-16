"use client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button, Badge } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface MessageItem {
  id: string;
  message: string;
  recipient_type: string;
  status: string;
  created_at: string;
}

interface MessageHistoryProps {
  recentTab: string;
  onRecentTabChange: (tab: string) => void;
  loading: boolean;
  filteredMessages: MessageItem[];
  messages: MessageItem[];
  messageLimit: number;
  onLoadMore: () => void;
}

const recentTabs = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "failed", label: "Failed" },
];

function getRecipientBadge(type: string): "info" | "success" | "warning" {
  const variants: Record<string, "info" | "success" | "warning"> = {
    individual: "info",
    class: "success",
    all: "warning",
  };
  return variants[type] || "info";
}

function getStatusBadge(status: string): "success" | "warning" {
  return status === "sent" ? "success" : "warning";
}

export default function MessageHistory({
  recentTab,
  onRecentTabChange,
  loading,
  filteredMessages,
  messages,
  messageLimit,
  onLoadMore,
}: MessageHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Messages</CardTitle>
      </CardHeader>
      <CardBody>
        <Tabs
          tabs={recentTabs}
          activeTab={recentTab}
          onChange={onRecentTabChange}
          className="mb-4"
        />
        {loading ? (
          <TableSkeleton rows={3} />
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            icon="sms"
            title="No messages sent yet"
            description={
              recentTab === "all"
                ? "Send your first message to get started"
                : `No ${recentTab} messages found`
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 bg-[var(--surface-container-low)] rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={getRecipientBadge(msg.recipient_type)}>
                    {msg.recipient_type === "individual"
                      ? "Individual"
                      : msg.recipient_type === "class"
                        ? "By Class"
                        : "All Parents"}
                  </Badge>
                  <Badge variant={getStatusBadge(msg.status)}>
                    {msg.status}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--on-surface)] mb-2">
                  {msg.message}
                </p>
                <p className="text-xs text-[var(--t3)]">
                  {new Date(msg.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {messages.length >= messageLimit && (
          <div className="mt-4 text-center">
            <Button
              variant="secondary"
              onClick={onLoadMore}
            >
              Load More
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
