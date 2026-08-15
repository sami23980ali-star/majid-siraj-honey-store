import { trpc } from "@/lib/trpc";
import type { CartLine } from "@shared/store";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type CheckoutCustomer = {
  customerName: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
};

/**
 * Hands the cart to the server, which matches each line to the right Shopify
 * variant by weight and records the attempt as an `awaiting_payment` order.
 *
 * Matching used to happen here in the browser: it fetched the first 25 Shopify
 * products, matched by title, then took the first `availableForSale` variant —
 * so the selected weight was ignored and a 1 كجم order could open a checkout for
 * the 250 جم jar. The client no longer decides which variant is sold.
 */
export function OnlinePaymentButton({
  items,
  customer,
  onCheckoutStarted,
}: {
  items: CartLine[];
  customer: CheckoutCustomer;
  onCheckoutStarted?: (result: { orderNumber: string; checkoutUrl: string }) => void;
}) {
  // Probe with the smallest possible page: it only answers "is online payment
  // configured at all", so there is no reason to pull a full catalogue.
  const availability = trpc.commerce.products.list.useQuery({ first: 1 }, { retry: false });
  const startCheckout = trpc.orders.createOnlineCheckout.useMutation({
    onSuccess(result) {
      onCheckoutStarted?.(result);
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    },
    onError(error) {
      toast.error(error.message || "تعذر فتح صفحة الدفع الآمن");
    },
  });

  // Nothing to offer when the store has no online-payment backend wired up.
  if (availability.isError || (availability.data && availability.data.length === 0)) return null;

  const missingContact = customer.customerName.trim().length < 2 || customer.phone.trim().length < 7;
  const disabled = startCheckout.isPending || availability.isLoading || missingContact || !items.length;

  return <div className="mt-3">
    <button
      type="button"
      disabled={disabled}
      onClick={() => startCheckout.mutate({ ...customer, items: items.map(item => ({ productId: item.productId, optionLabel: item.option.label, quantity: item.quantity })) })}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d7b56d] bg-[#fffaf0] px-5 py-3.5 text-sm font-bold text-[#5e3508] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#f9edda] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {startCheckout.isPending ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
      {startCheckout.isPending ? "جاري فتح الدفع الآمن…" : "الدفع الإلكتروني الآمن"}
    </button>
    <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] leading-5 text-[#806743]">
      <ShieldCheck size={13} className="text-[#4c7a2c]" />
      {missingContact ? "اكتب الاسم ورقم الهاتف أولًا لحفظ الطلب ومتابعته." : "سيتم تحويلك إلى صفحة دفع آمنة منفصلة، ويُحفظ طلبك للمتابعة."}
    </p>
  </div>;
}
