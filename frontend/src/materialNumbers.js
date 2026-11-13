export function parseMaterialNumberQuery(query) {
  const match = query.trim().normalize('NFKC').match(/^(?:编号\s*|#|sc-)?(\d{1,6})$/i);
  return match ? Number(match[1]) : null;
}

export function materialNumberLabel(number) {
  return Number.isInteger(number) && number > 0 ? `编号 ${String(number).padStart(4, '0')}` : '编号待分配';
}
