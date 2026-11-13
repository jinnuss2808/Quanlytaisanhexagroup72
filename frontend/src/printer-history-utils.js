// Tiện ích lịch sử bảo trì máy in. Không truy cập Firebase và không thay đổi dữ liệu.
export const isRepairEntry = entry => entry?.type !== 'replace_toner';

export function formatPrinterMoney(value) {
  const parsed = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(parsed) || parsed < 0) return 'Chưa ghi chi phí';
  return `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0}).format(parsed)} ₫`;
}

export function formatPrinterDate(date, timestamp) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  const point = date || timestamp;
  if (!point) return 'Chưa có ngày';
  const parsed = new Date(point);
  return Number.isNaN(parsed.getTime()) ? 'Chưa có ngày' : parsed.toLocaleDateString('vi-VN');
}

export function getPrinterRepairTotals(events) {
  const repairs = (Array.isArray(events) ? events : []).filter(isRepairEntry);
  let total = 0;
  let unknown = 0;
  for (const item of repairs) {
    const value = item?.cost;
    const amount = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(amount) || amount < 0) {
      unknown += 1;
    } else {
      total += amount;
    }
  }
  return {count: repairs.length, total, unknown};
}
