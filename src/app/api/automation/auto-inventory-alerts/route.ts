import { NextRequest, NextResponse } from "next/server";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const { schoolId } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    // Get all inventory items (assets) with stock below reorder threshold
    const { data: items, error: itemsError } = await supabase
      .from("assets")
      .select(
        `
        id,
        name,
        type,
        current_stock,
        reorder_level,
        unit_cost,
        category,
        supplier_name,
        supplier_contact,
        last_restocked_at
      `,
      )
      .eq("school_id", school.schoolId);

    if (itemsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch inventory items",
          details: itemsError.message,
        },
        { status: 500 },
      );
    }

    const itemsNeedingReorder: any[] = [];
    const alertsSent: any[] = [];
    const errors: any[] = [];

    for (const item of items as any[]) {
      const currentStock = item.current_stock || 0;
      const reorderLevel = item.reorder_level || 0;

      if (reorderLevel > 0 && currentStock <= reorderLevel) {
        const deficit = reorderLevel - currentStock;
        const estimatedCost = item.unit_cost ? deficit * item.unit_cost : null;

        itemsNeedingReorder.push({
          itemId: item.id,
          name: item.name,
          category: item.category || item.type,
          currentStock,
          reorderLevel,
          deficit,
          unitCost: item.unit_cost,
          estimatedCost,
          supplier: item.supplier_name,
          supplierContact: item.supplier_contact,
          lastRestocked: item.last_restocked_at,
        });

        // Send email alert if configured
        if (item.supplier_contact) {
          try {
            await sendInventoryAlertEmail(
              item.supplier_contact,
              item.name,
              currentStock,
              reorderLevel,
              deficit,
              estimatedCost,
            );

            alertsSent.push({
              itemId: item.id,
              name: item.name,
              channel: "email",
              recipient: item.supplier_contact,
            });
          } catch (emailErr) {
            errors.push({
              itemId: item.id,
              name: item.name,
              reason: `Email alert failed: ${emailErr instanceof Error ? emailErr.message : "Unknown error"}`,
            });
          }
        }

        // Send SMS alert if phone is available
        const phone =
          item.supplier_contact?.includes("+") ||
          item.supplier_contact?.match(/^\d{10,}$/)
            ? item.supplier_contact
            : null;

        if (phone) {
          try {
            const smsMessage = `ALERT: ${item.name} stock is low (${currentStock} units). Reorder level: ${reorderLevel}. Please restock.`;
            const smsResult = await sendSMS(phone, smsMessage);

            if (smsResult.success) {
              alertsSent.push({
                itemId: item.id,
                name: item.name,
                channel: "sms",
                recipient: phone,
              });
            } else {
              errors.push({
                itemId: item.id,
                name: item.name,
                reason: `SMS failed: ${smsResult.error}`,
              });
            }
          } catch (smsErr) {
            errors.push({
              itemId: item.id,
              name: item.name,
              reason: `SMS alert failed: ${smsErr instanceof Error ? smsErr.message : "Unknown error"}`,
            });
          }
        }

        // Log the alert in the database
        await supabase.from("inventory_alerts").insert({
          school_id: school.schoolId,
          asset_id: item.id,
          alert_type: "low_stock",
          current_stock: currentStock,
          reorder_level: reorderLevel,
          deficit,
          notified_at: new Date().toISOString(),
          status: "pending",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalItemsChecked: items.length,
        itemsNeedingReorder: itemsNeedingReorder.length,
        alertsSent: alertsSent.length,
        errors: errors.length,
      },
      results: {
        itemsNeedingReorder,
        alertsSent,
        errors,
      },
    });
  } catch (error) {
    console.error("Auto inventory alerts error:", error);
    return NextResponse.json(
      {
        error: "Auto inventory alerts failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function sendInventoryAlertEmail(
  email: string,
  itemName: string,
  currentStock: number,
  reorderLevel: number,
  deficit: number,
  estimatedCost: number | null,
) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log(
      `[EMAIL] Inventory alert for ${itemName} (stock: ${currentStock}/${reorderLevel}) would be sent to ${email}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const html = `
    <h2>Inventory Reorder Alert</h2>
    <p><strong>Item:</strong> ${itemName}</p>
    <p><strong>Current Stock:</strong> ${currentStock}</p>
    <p><strong>Reorder Level:</strong> ${reorderLevel}</p>
    <p><strong>Deficit:</strong> ${deficit} units needed</p>
    ${estimatedCost ? `<p><strong>Estimated Cost:</strong> UGX ${estimatedCost.toLocaleString()}</p>` : ""}
    <p>Please arrange for restocking as soon as possible.</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@omuto.org",
      to: [email],
      subject: `Inventory Alert: ${itemName} - Low Stock`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }

  const data = await response.json();
  return { success: true, messageId: data.id };
}

async function sendSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const username = process.env.SMS_USERNAME || "sandbox";

    if (!apiKey) {
      console.log(`[SMS] To: ${phone}, Message: ${message}`);
      return { success: true, messageId: "dev-mode" };
    }

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apikey: apiKey,
        },
        body: new URLSearchParams({
          username,
          to: phone,
          message,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    const messageId = data.SMSMessageData?.Recipients?.[0]?.messageId;

    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
