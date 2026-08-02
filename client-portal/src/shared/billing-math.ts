/**
 * Pure Decoupled Billing Math Engine — BillDoor (§5.4)
 * 
 * Executes line-item tax extraction, slab-aggregate GST calculation,
 * MRP savings computation, and Math.ceil ceiling rounding.
 * Used identically on Client Create Bill page and Server Actions.
 */

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
  gstPercent?: number;
  mrp?: number | null;
}

export interface CalculatedLineItem extends LineItemInput {
  lineAmount: number;
  taxableValue: number;
  gstAmount: number;
}

export interface BillTotalsInput {
  lineItems: LineItemInput[];
  extraCharges?: number;
  rewardDiscount?: number;
  discountTotal?: number;
  gstCalculationMode?: 'exclusive' | 'inclusive';
}

export interface BillTotalsResult {
  processedItems: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  totalMrpSavings: number;
  rawGrand: number;
  grandTotal: number;
  roundOffAmount: number;
  slabMap: Map<number, { taxable: number; gst: number }>;
}

export function calculateBillTotals({
  lineItems,
  extraCharges = 0,
  rewardDiscount = 0,
  discountTotal = 0,
  gstCalculationMode = 'exclusive',
}: BillTotalsInput): BillTotalsResult {
  const isInclusive = gstCalculationMode === 'inclusive';

  // 1. Per-item computation (unrounded float precision)
  const processedItems: CalculatedLineItem[] = lineItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    const baseLine = Math.max(0, qty * price - disc);
    const rate = Number(item.gstPercent) || 0;

    let taxableValue = baseLine;
    let gstAmount = 0;
    let lineAmount = baseLine;

    if (rate > 0) {
      if (isInclusive) {
        // Inclusive (GST already in price): Extract tax backward
        // Example: ₹100 with 10% → Taxable ₹90.91 + GST ₹9.09 = ₹100 Total
        taxableValue = baseLine / (1 + rate / 100);
        gstAmount = baseLine - taxableValue;
        lineAmount = baseLine;
      } else {
        // Exclusive (Add GST on top): Base price + GST
        // Example: ₹100 + 18% GST = Taxable ₹100 + GST ₹18 = ₹118 Total
        taxableValue = baseLine;
        gstAmount = baseLine * (rate / 100);
        lineAmount = taxableValue + gstAmount;
      }
    }

    return {
      ...item,
      lineAmount,
      taxableValue,
      gstAmount,
    };
  });

  // 2. Slab-aggregate rounding (group by GST rate, round at slab level)
  const slabMap = new Map<number, { taxable: number; gst: number }>();
  for (const item of processedItems) {
    const rate = Number(item.gstPercent) || 0;
    const slab = slabMap.get(rate) || { taxable: 0, gst: 0 };
    slab.taxable += item.taxableValue;
    slab.gst += item.gstAmount;
    slabMap.set(rate, slab);
  }

  let subtotal = 0;
  let gstTotal = 0;
  for (const [, slab] of slabMap) {
    subtotal += Math.round(slab.taxable * 100) / 100;
    gstTotal += Math.round(slab.gst * 100) / 100;
  }

  // 3. MRP savings (frozen at creation time)
  const totalMrpSavings = processedItems.reduce((sum, item) => {
    if (item.mrp && Number(item.mrp) > Number(item.unitPrice)) {
      return sum + (Number(item.mrp) - Number(item.unitPrice)) * (Number(item.quantity) || 0);
    }
    return sum;
  }, 0);

  // 4. Grand total with Math.ceil ceiling rounding to next whole rupee
  const netExtra = Number(extraCharges) || 0;
  const netReward = Number(rewardDiscount) || 0;
  const netDiscTotal = Number(discountTotal) || 0;

  const rawGrand = Math.max(0, subtotal + gstTotal - netReward + netExtra - netDiscTotal);
  const grandTotal = Math.ceil(rawGrand);
  const roundOffAmount = Math.round((grandTotal - rawGrand) * 100) / 100;

  return {
    processedItems,
    subtotal,
    gstTotal,
    totalMrpSavings,
    rawGrand,
    grandTotal,
    roundOffAmount,
    slabMap,
  };
}
