/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requirePrintAgentOrg, toAgentErrorResponse } from "@/lib/printing/agent-auth";
import { renderTicket, TicketOrder } from "@/lib/printing/render-ticket";

function buildTicketOrder(order: any): TicketOrder {
  const metadata = (order.metadata || {}) as Record<string, any>;
  const rawEvent = (order.raw_event || {}) as Record<string, any>;
  const eventOrder = rawEvent.order || rawEvent.message?.order || rawEvent.statusUpdate?.order;
  const eventCustomer = eventOrder?.customer || metadata.customer;
  const eventRestaurant = eventOrder?.restaurant || metadata.restaurant;
  const structuredOutput = metadata.structuredOutput || metadata.structured_output;
  const extraction = metadata.extraction || {};

  return {
    restaurantName: metadata.restaurantName || eventRestaurant?.name || metadata.businessName,
    restaurantPhone: metadata.restaurantPhone || eventRestaurant?.phone || metadata.phone,
    orderNumber: order.order_id,
    confirmedAt: order.confirmed_at,
    fulfillment:
      metadata.fulfillment ||
      extraction.fulfillment ||
      structuredOutput?.fulfillment ||
      order.fulfillment_type ||
      eventOrder?.fulfillment ||
      eventOrder?.type,
    items: order.items,
    notes: metadata.notes || eventOrder?.notes || metadata.specialInstructions || order.special_instructions,
    allergies: metadata.allergies || eventOrder?.allergies || order.allergies,
    customer: {
      name:
        metadata.customerName ||
        structuredOutput?.customerName ||
        eventCustomer?.name ||
        order.customer_name,
      phone:
        metadata.customerPhone ||
        structuredOutput?.customerPhone ||
        eventCustomer?.phone ||
        order.customer_phone,
      address:
        metadata.customerAddress ||
        structuredOutput?.address ||
        eventCustomer?.address ||
        eventOrder?.customerAddress ||
        eventOrder?.deliveryAddress ||
        rawEvent?.customerAddress ||
        rawEvent?.deliveryAddress ||
        order.customer_address ||
        structuredOutput?.address,
    },
    totalAmount: order.total_amount,
    currency: order.currency,
  };
}

function resolvePrinterTarget(order: any): string | undefined {
  const metadata = (order.metadata || {}) as Record<string, any>;
  return metadata.printer_target || metadata.printerTarget || undefined;
}

export async function GET(req: NextRequest) {
  try {
    const org = await requirePrintAgentOrg(req);
    const pool = getPool();

    const claimResult = await pool.query(
      `WITH candidate AS (
         SELECT id
         FROM print_jobs
         WHERE organization_id = $1
           AND status IN ('queued', 'retrying')
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE print_jobs pj
       SET status = 'retrying',
           updated_at = NOW()
       FROM candidate
       WHERE pj.id = candidate.id
       RETURNING pj.*`,
      [org.id]
    );

    if (claimResult.rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const job = claimResult.rows[0];
    const orderResult = await pool.query(
      `SELECT *
       FROM orders
       WHERE organization_id = $1 AND order_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [org.id, job.order_id]
    );

    if (orderResult.rows.length === 0) {
      await pool.query(
        `UPDATE print_jobs
         SET status = 'failed',
             attempts = attempts + 1,
             last_error = 'order_not_found',
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [job.id, org.id]
      );

      return NextResponse.json({
        ok: false,
        error: "order_not_found",
      }, { status: 404 });
    }

    const order = orderResult.rows[0];
    const ticketText = renderTicket(buildTicketOrder(order));

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        organizationId: org.id,
        organizationSlug: org.slug,
        orderId: job.order_id,
        callId: job.call_id,
        printerTarget: job.printer_target || resolvePrinterTarget(order) || null,
        ticketText,
        attempts: Number(job.attempts) || 0,
        createdAt: job.created_at,
      },
    });
  } catch (error) {
    const { status, error: message } = toAgentErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
