/**
 * GST computation in integer paise. India: intra-state splits into CGST+SGST
 * (each half the tax); inter-state is a single IGST. All money is paise (int).
 */
export type PlaceOfSupply = 'intra' | 'inter';

export interface GstBreakup {
  basePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
}

function roundPaise(n: number): number {
  return Math.round(n);
}

/**
 * @param amountPaise price entered (gross if taxInclusive, else net)
 * @param gstRatePct e.g. 5, 12, 18, 28
 * @param taxInclusive whether amountPaise already includes GST
 * @param place intra-state (CGST+SGST) or inter-state (IGST)
 */
export function computeGst(
  amountPaise: number,
  gstRatePct: number,
  taxInclusive: boolean,
  place: PlaceOfSupply,
): GstBreakup {
  if (amountPaise < 0 || gstRatePct < 0) throw new Error('amount and rate must be >= 0');
  const rate = gstRatePct / 100;

  let basePaise: number;
  let totalPaise: number;
  if (taxInclusive) {
    totalPaise = amountPaise;
    basePaise = roundPaise(amountPaise / (1 + rate));
  } else {
    basePaise = amountPaise;
    totalPaise = roundPaise(amountPaise * (1 + rate));
  }
  const taxPaise = totalPaise - basePaise;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (place === 'intra') {
    cgstPaise = Math.floor(taxPaise / 2);
    sgstPaise = taxPaise - cgstPaise; // remainder paise to SGST so halves sum to tax
  } else {
    igstPaise = taxPaise;
  }

  return { basePaise, cgstPaise, sgstPaise, igstPaise, taxPaise, totalPaise };
}
