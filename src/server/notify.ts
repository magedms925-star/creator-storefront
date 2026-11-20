import { sendEmail } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { formatDateTime, formatMoney } from "@/lib/money";

interface Sale {
  storeName: string;
  ownerEmail: string;
  productTitle: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  currency: string;
  accessUrl: string;
  slotStart: number | null;
}

/** Receipt to the buyer and a notice to the owner. Email is optional: a refusal is ignored. */
export async function notifySale(sale: Sale): Promise<void> {
  const total = formatMoney(sale.amount, sale.currency);
  const when = sale.slotStart ? `\nBooked for: ${formatDateTime(sale.slotStart)}` : "";
  const send = (to: string, subject: string, text: string) =>
    sendEmail({ env, for: { background: true }, message: { to, subject, text } }).catch(() => undefined);
  await Promise.all([
    send(
      sale.buyerEmail,
      `Your order from ${sale.storeName}`,
      `Hi ${sale.buyerName},\n\nThanks for buying ${sale.productTitle} (${total}).${when}\n\nOpen it here: ${sale.accessUrl}\n`,
    ),
    send(
      sale.ownerEmail,
      `New sale: ${sale.productTitle}`,
      `${sale.buyerName} <${sale.buyerEmail}> bought ${sale.productTitle} for ${total}.${when}\n`,
    ),
  ]);
}
