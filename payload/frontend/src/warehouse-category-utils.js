// HEXA: Match company asset-catalog categories to device-stock filter groups.
// This prevents the warehouse dropdown from only filtering loose stock materials.
const aliases = {
  laptop: ['laptop', 'notebook', 'maytinhxachtay'],
  pc: ['pc', 'desktop', 'maytinhdeban', 'maytinhban'],
  mouse: ['mouse', 'chuot', 'chuotmaytinh'],
  keyboard: ['keyboard', 'banphim'],
  spare: ['spare', 'linhkien', 'phukien'],
  other: ['other', 'thietbikhac', 'thietbi'],
  ink: ['ink', 'mucin', 'muc', 'toner'],
};

export const normalizeCategoryCode = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');

export function findAssetCategoryIds(catalogs, group) {
  if (!group || group === 'all') return [];
  const groupAliases = aliases[group] || [group];
  return (Array.isArray(catalogs) ? catalogs : [])
    .filter(item => {
      const code = normalizeCategoryCode(item?.code);
      const name = normalizeCategoryCode(item?.name);
      return groupAliases.some(alias => code === alias || name === alias ||
        (alias.length > 3 && (code.includes(alias) || name.includes(alias))));
    })
    .map(item => item.id).filter(Boolean);
}

const empty = (page = 1) => ({items:[],total:0,page,totalPages:1,pageSize:100});

export async function loadAvailableAssets(api, {category, catalogs, page = 1, search = '', sortBy = '', sortDirection = 'asc'}) {
  const requestedPage = Math.max(1, Number(page) || 1);
  const args = new URLSearchParams({status:'available',pageSize:'100',search:String(search || '')});
  if(sortBy) {args.set('sortBy',sortBy);args.set('sortDirection',sortDirection);}
  if (!category || category === 'all') {
    args.set('page', String(requestedPage));
    return api(`/assets?${args}`);
  }
  const categoryIds = findAssetCategoryIds(catalogs, category);
  if (!categoryIds.length) return empty(requestedPage);
  if (categoryIds.length === 1) {
    args.set('categoryId', categoryIds[0]);
    args.set('page', String(requestedPage));
    return api(`/assets?${args}`);
  }
  // In rare projects, multiple category IDs can represent the same device group.
  // Fetch each category's pages and paginate the combined result, not just the first 100.
  const groups = await Promise.all(categoryIds.map(async categoryId => {
    const params = new URLSearchParams(args);
    params.set('categoryId', categoryId);
    params.set('page','1');
    const first = await api(`/assets?${params}`);
    const pages = Math.min(50, Math.max(1, Number(first?.totalPages) || 1));
    if (Number(first?.totalPages) > 50) throw Error('Danh mục quá lớn để lọc. Hãy thu hẹp bằng ô tìm kiếm.');
    if (pages === 1) return Array.isArray(first.items) ? first.items : [];
    const next = await Promise.all(Array.from({length:pages-1}, (_,i) => {
      const p = new URLSearchParams(params);p.set('page', String(i+2));
      return api(`/assets?${p}`);
    }));
    return [first,...next].flatMap(x => Array.isArray(x.items) ? x.items : []);
  }));
  const deduped = [...new Map(groups.flat().map(item => [item.id,item])).values()];
  if(sortBy)deduped.sort((a,b) => {
    const av=a[sortBy]??'', bv=b[sortBy]??'';
    const v=typeof av==='number'&&typeof bv==='number' ? av-bv : String(av).localeCompare(String(bv),'vi',{numeric:true});
    return sortDirection==='desc'?-v:v;
  });
  else deduped.sort((a,b) => (Number(b.createdAt)||0) - (Number(a.createdAt)||0));
  const start = (requestedPage-1)*100;
  return {items:deduped.slice(start,start+100),total:deduped.length,page:requestedPage,pageSize:100,
    totalPages:Math.max(1,Math.ceil(deduped.length/100))};
}
