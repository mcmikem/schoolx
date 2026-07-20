import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow, requireExistingSchoolOrDeny } from "@/lib/api-utils";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { sendAfricasTalkingSMSWithRetry, checkSmsDailyLimit } from "@/lib/africas-talking";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const { schoolId } = await request.json();
    const supabase = createServiceRoleClientOrThrow();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const subCheck = await requireActiveSubscription({
      supabase,
      schoolId: school.schoolId,
      requiredPlan: "growth",
    });
    if (!subCheck.ok) return subCheck.response;

    // Get all inventory items (assets) with reorder thresholds
    const { data: items, error: itemsError } = await supabase
      .from("assets")
      .select(
        `
        id,
        name,
        category,
        quantity,
        unit_price,
        supplier,
        reorder_level
      `,
      )
      .eq("school_id", school.schoolId);

    if (itemsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch inventory items",
          details: "Internal server error",
        },
        { status: 500 },
      );
    }

    const itemsNeedingReorder: any[] = [];
    const alertsSent: any[] = [];
    const errors: any[] = [];

    for (const item of items as any[]) {
      const currentStock = item.quantity || 0;
      const reorderLevel = Number(item.reorder_level || 0);

      if (reorderLevel > 0 && currentStock <= reorderLevel) {
        const deficit = reorderLevel - currentStock;
        const estimatedCost = item.unit_price ? deficit * item.unit_price : null;

        itemsNeedingReorder.push({
          itemId: item.id,
          name: item.name,
          category: item.category,
          currentStock,
          reorderLevel,
          deficit,
          unitCost: item.unit_price,
          estimatedCost,
          supplier: item.supplier,
        });

        // Send email alert if configured and supplier looks like an email
        if (item.supplier && item.supplier.includes("@")) {
          try {
            await sendInventoryAlertEmail(item.supplier, item.name, currentStock, reorderLevel, deficit, estimatedCost);

            alertsSent.push({
              itemId: item.id,
              name: item.name,
              channel: "email",
              recipient: item.supplier,
            });
          } catch (emailErr) {
            errors.push({
              itemId: item.id,
              name: item.name,
              reason: `Email alert failed: ${emailErr instanceof Error ? emailErr.message : "Unknown error"}`,
            });
          }
        }

        // Send SMS alert if supplier has a phone number
        const phone = item.supplier?.includes("+") || item.supplier?.match(/^\d{10,}$/) ? item.supplier : null;

        if (phone) {
          try {
            const withinLimit = await checkSmsDailyLimit(school.schoolId, 1);
            if (!withinLimit) {
              errors.push({
                itemId: item.id,
                name: item.name,
                reason: "Daily SMS limit reached",
              });
            } else {
              const smsMessage = `ALERT: ${item.name} stock is low (${currentStock} units). Reorder level: ${reorderLevel}. Please restock.`;
              const smsResult = await sendAfricasTalkingSMSWithRetry(phone, smsMessage, {
                formatUgandaNumber: true,
              });

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
    logger.error("Auto inventory alerts error:", error);
    return NextResponse.json(
      {
        error: "Auto inventory alerts failed",
        details: "Internal server error",
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
    return {
      success: false,
      error: "Email service not configured. Set RESEND_API_KEY to send inventory alerts.",
    };
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
