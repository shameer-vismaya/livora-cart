import { computeGst } from './gst';

describe('computeGst', () => {
  it('exclusive intra-state 18% splits CGST/SGST', () => {
    const r = computeGst(10000, 18, false, 'intra'); // base 100.00
    expect(r.basePaise).toBe(10000);
    expect(r.taxPaise).toBe(1800);
    expect(r.cgstPaise).toBe(900);
    expect(r.sgstPaise).toBe(900);
    expect(r.igstPaise).toBe(0);
    expect(r.totalPaise).toBe(11800);
  });

  it('exclusive inter-state 18% is all IGST', () => {
    const r = computeGst(10000, 18, false, 'inter');
    expect(r.igstPaise).toBe(1800);
    expect(r.cgstPaise).toBe(0);
    expect(r.totalPaise).toBe(11800);
  });

  it('inclusive 5% extracts base', () => {
    const r = computeGst(10500, 5, true, 'intra'); // total 105.00 incl 5%
    expect(r.totalPaise).toBe(10500);
    expect(r.basePaise).toBe(10000);
    expect(r.taxPaise).toBe(500);
    expect(r.cgstPaise + r.sgstPaise).toBe(500);
  });

  it('odd-paise tax: halves sum exactly to tax', () => {
    const r = computeGst(333, 5, false, 'intra'); // tax = round(16.65)=17
    expect(r.taxPaise).toBe(r.cgstPaise + r.sgstPaise);
  });

  it('rejects negatives', () => {
    expect(() => computeGst(-1, 5, false, 'intra')).toThrow();
  });
});
