import { createServiceRoleClientOrThrow } from "@/lib/api-utils";
import {
  CHANNEL_SETTING_KEY,
  sendSchoolMessage,
  type MessagingChannel,
  type ParentMessageKind,
  type SchoolMessageResult,
} from "@/lib/messaging";
import { logger } from "@/lib/logger";

export { CHANNEL_SETTING_KEY };

/** Reads a single school_settings value using the service-role client. */
function makeReader(supabase: ReturnType<typeof createServiceRoleClientOrThrow>, schoolId: string) {
  return async (key: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("school_settings")
      .select("value")
      .eq("school_id", schoolId)
      .eq("key", key)
      .maybeSingle();
    if (error) {
      logger.warn("[messaging] setting read failed", key, error.message);
      return null;
    }
    return (data?.value as string | undefined) ?? null;
  };
}

/**
 * Server-side send for automation routes: resolves the school's channel and
 * template from school_settings, then dispatches. This is the only entry point
 * automations should use for parent/staff messaging.
 */
export async function sendToParent(
  supabase: ReturnType<typeof createServiceRoleClientOrThrow>,
  args: {
    schoolId: string;
    to: string;
    message: string;
    kind: ParentMessageKind;
  },
): Promise<SchoolMessageResult> {
  return sendSchoolMessage(args.to, args.message, {
    schoolId: args.schoolId,
    kind: args.kind,
    readSetting: makeReader(supabase, args.schoolId),
  });
}

/** Which channel would actually be used for this school, right now. */
export async function getSchoolChannel(
  supabase: ReturnType<typeof createServiceRoleClientOrThrow>,
  schoolId: string,
): Promise<MessagingChannel | null> {
  const stored = await makeReader(supabase, schoolId)(CHANNEL_SETTING_KEY);
  return stored === "whatsapp" || stored === "sms" ? stored : null;
}
