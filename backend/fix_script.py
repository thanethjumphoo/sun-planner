import sys
import re

files = ['src/unified-leg-logic.helper.ts', 'src/bl-logic.helper.ts']

replacement = '''  const extractBeltGateSizes = (itemDesc: string, productSize: string) => {
    const desc = (itemDesc || '').toUpperCase();
    
    // 1. Prioritize explicit Product Spec size if provided and matches our bins
    if (productSize && productSize.toLowerCase() !== 'unsize' && productSize.trim() !== '') {
      let s = productSize.toLowerCase().replace('g', '').trim();
      if (s.includes('down')) {
        const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
        return { rmSizes: [`BL ${val} Down`], targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
      }
      if (s.includes('up')) {
        const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
        return { rmSizes: [`BL ${val} Up`], targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
      }

      const allBinDefs = [
        { key: 'BL 140 Down', lo: 0, hi: 140 },
        { key: 'BL 141-160', lo: 141, hi: 160 },
        { key: 'BL 161-180', lo: 161, hi: 180 },
        { key: 'BL 181-200', lo: 181, hi: 200 },
        { key: 'BL 201-220', lo: 201, hi: 220 },
        { key: 'BL 221-240', lo: 221, hi: 240 },
        { key: 'BL 241-260', lo: 241, hi: 260 },
        { key: 'BL 261-280', lo: 261, hi: 280 },
        { key: 'BL 281-300', lo: 281, hi: 300 },
        { key: 'BL 301-320', lo: 301, hi: 320 },
        { key: 'BL 321-340', lo: 321, hi: 340 },
        { key: 'BL 341-360', lo: 341, hi: 360 },
        { key: 'BL 361-380', lo: 361, hi: 380 },
        { key: 'BL 381 Up', lo: 381, hi: 9999 }
      ];
      
      let lo = -1, hi = -1;
      const m = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
      if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
      else {
        const singleMatch = s.match(/^(\\d+)$/);
        if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = parseInt(singleMatch[1], 10); }
      }

      if (lo >= 0 && hi >= 0 && hi >= lo) {
        const overlaps = allBinDefs.filter(b => {
          if (lo === hi) return lo >= b.lo && hi <= b.hi;
          return Math.max(lo, b.lo) < Math.min(hi, b.hi);
        });
        if (overlaps.length > 0) {
          return { rmSizes: overlaps.map(b => b.key), targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
        }
      }
    }

    // 2. Try DB mapping if productSize didn't yield a valid bin
    for (const rule of blBeltGateMatrix as any[]) {
      if (desc.includes(rule.targetProduct)) {
        return { rmSizes: [rule.rmSize], targetProduct: rule.targetProduct, yieldPct: Number(rule.yieldPct || 100) };
      }
    }

    // 3. Regex fallback using Item Description
    let s = desc.toLowerCase().replace('g', '').trim();
    if (s.includes('down')) {
      const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
      return { rmSizes: [`BL ${val} Down`], targetProduct: `Fallback (${desc})`, yieldPct: 100 };
    }
    if (s.includes('up')) {
      const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
      return { rmSizes: [`BL ${val} Up`], targetProduct: `Fallback (${desc})`, yieldPct: 100 };
    }

    const allBinDefs = [
        { key: 'BL 140 Down', lo: 0, hi: 140 },
        { key: 'BL 141-160', lo: 141, hi: 160 },
        { key: 'BL 161-180', lo: 161, hi: 180 },
        { key: 'BL 181-200', lo: 181, hi: 200 },
        { key: 'BL 201-220', lo: 201, hi: 220 },
        { key: 'BL 221-240', lo: 221, hi: 240 },
        { key: 'BL 241-260', lo: 241, hi: 260 },
        { key: 'BL 261-280', lo: 261, hi: 280 },
        { key: 'BL 281-300', lo: 281, hi: 300 },
        { key: 'BL 301-320', lo: 301, hi: 320 },
        { key: 'BL 321-340', lo: 321, hi: 340 },
        { key: 'BL 341-360', lo: 341, hi: 360 },
        { key: 'BL 361-380', lo: 361, hi: 380 },
        { key: 'BL 381 Up', lo: 381, hi: 9999 }
    ];
    
    let lo = -1, hi = -1;
    const m = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
    if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
    else {
      const singleMatch = s.match(/^(\\d+)$/);
      if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = parseInt(singleMatch[1], 10); }
    }

    if (lo >= 0 && hi >= 0 && hi >= lo) {
      const overlaps = allBinDefs.filter(b => {
        if (lo === hi) return lo >= b.lo && hi <= b.hi;
        return Math.max(lo, b.lo) < Math.min(hi, b.hi);
      });
      if (overlaps.length > 0) {
        return { rmSizes: overlaps.map(b => b.key), targetProduct: `Fallback (${desc})`, yieldPct: 100 };
      }
    }

    return null;
  };'''

for f in files:
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
    
    if "bl-logic.helper.ts" in f:
        pattern = r"  const extractBeltGateSizes = \(desc: string, specSize\?: string\): \{ rmSizes: string\[\], targetProduct: string, yieldPct: number \} \| null => \{[\s\S]*?return null;\n  \};"
        content = re.sub(pattern, replacement, content)
    else:
        pattern = r"  const extractBeltGateSizes = \(itemDesc: string, productSize: string\) => \{[\s\S]*?return null;\n  \};"
        content = re.sub(pattern, replacement, content)
        
    with open(f, "w", encoding="utf-8") as file:
        file.write(content)
