// HEXA: sắp xếp hai trạng thái: mặc định -> tăng dần -> mặc định.
export function toggleColumnSort(current, key) {
  return current === key ? '' : key;
}

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
export function sortVisibleRows(rows, key, selector = row => row?.[key]) {
  const input = Array.isArray(rows) ? rows : [];
  if (!key) return input;
  return input.map((row, index) => ({ row, index })).sort((a, b) => {
    const av = selector(a.row);
    const bv = selector(b.row);
    const blankA = av === undefined || av === null || String(av).trim() === '';
    const blankB = bv === undefined || bv === null || String(bv).trim() === '';
    if (blankA !== blankB) return blankA ? 1 : -1;
    if (blankA && blankB) return a.index - b.index;
    const diff = typeof av === 'number' && typeof bv === 'number'
      ? av - bv : collator.compare(String(av), String(bv));
    return diff || a.index - b.index;
  }).map(({ row }) => row);
}
