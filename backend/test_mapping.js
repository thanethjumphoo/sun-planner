const extractBeltGateSizes = (itemDesc, productSize) => {
    if (productSize && productSize.toLowerCase() !== 'unsize' && productSize.trim() !== '') {
      let s = productSize.toLowerCase().replace('g', '').trim();
      
      if (s.includes('down')) {
        const val = parseInt(s.replace(/[^\d]/g, ''), 10);
        return { rmSizes: [`BL ${val} Down`], targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
      }
      if (s.includes('up')) {
        const val = parseInt(s.replace(/[^\d]/g, ''), 10);
        return { rmSizes: [`BL ${val} Up`], targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
      }

      if (s.match(/\d+/)) {
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
            return { rmSizes: overlaps.map(b => b.key), targetProduct: `Fallback (${productSize})`, yieldPct: 100 };
          }
        }
      }
    }
    
    return null;
  };

console.log(extractBeltGateSizes('Desc', 'Size 241-260'));
console.log(extractBeltGateSizes('Desc', '241-260'));
console.log(extractBeltGateSizes('Desc', '240-260'));
