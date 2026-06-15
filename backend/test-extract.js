function extractBeltGateSizes(desc, specSize) {
    let sToUse = specSize;
    if (!sToUse || sToUse.toLowerCase() === 'unsize' || sToUse.trim() === '') {
      const descMatch = desc.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (descMatch) {
        sToUse = descMatch[0];
      } else {
        const descSingle = desc.match(/\b(\d{2,4})\s*(g|กรัม|g\.|gram)\b/i);
        if (descSingle) sToUse = descSingle[1];
      }
    }

    if (sToUse && sToUse.toLowerCase() !== 'unsize' && sToUse.trim() !== '') {
      const s = sToUse.toLowerCase().trim();
      const allBinDefs = [
        { key: 'BL 140 Down', lo: 0, hi: 140 },
        { key: 'BL 140-160', lo: 140, hi: 160 },
        { key: 'BL 160-180', lo: 160, hi: 180 },
        { key: 'BL 180-200', lo: 180, hi: 200 },
        { key: 'BL 200-220', lo: 200, hi: 220 },
        { key: 'BL 220-240', lo: 220, hi: 240 },
        { key: 'BL 240-260', lo: 240, hi: 260 },
        { key: 'BL 260-280', lo: 260, hi: 280 },
        { key: 'BL 280-300', lo: 280, hi: 300 },
        { key: 'BL 300-320', lo: 300, hi: 320 },
        { key: 'BL 320-340', lo: 320, hi: 340 },
        { key: 'BL 340-360', lo: 340, hi: 360 },
        { key: 'BL 360-380', lo: 360, hi: 380 },
        { key: 'BL 380 Up', lo: 380, hi: 9999 }
      ];
      
      let lo = -1, hi = -1;
      const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
      else {
        const singleMatch = s.match(/^(\d+)$/);
        if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = parseInt(singleMatch[1], 10); }
      }

      if (lo >= 0 && hi >= 0 && hi >= lo) {
        const overlaps = allBinDefs.filter(b => {
          if (lo === hi) return lo >= b.lo && hi <= b.hi;
          return Math.max(lo, b.lo) < Math.min(hi, b.hi);
        });
        if (overlaps.length > 0) {
          return { rmSizes: overlaps.map(b => b.key), targetProduct: `Fallback (${sToUse})`, yieldPct: 100 };
        }
      }
    }
    return null;
}

console.log(extractBeltGateSizes('HERB FED BL 240-260 G.', undefined));
