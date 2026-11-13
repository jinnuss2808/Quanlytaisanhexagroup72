import React from 'react';
import {ArrowUp, ArrowUpDown} from 'lucide-react';

export default function SortableHeader({label,sortKey,activeKey,onToggle,title}) {
  const active=activeKey===sortKey;
  return <th scope="col" aria-sort={active?'ascending':'none'}>
    <button type="button" className={'am-sort-toggle'+(active?' is-active':'')}
      title={title || (active ? `Bỏ sắp xếp theo ${label}` : `Sắp xếp tăng dần theo ${label}`)}
      aria-label={`${label}: ${active?'bỏ sắp xếp':'sắp xếp tăng dần'}`}
      onClick={()=>onToggle(sortKey)}>
      <span>{label}</span>{active?<ArrowUp size={13} aria-hidden="true"/>:<ArrowUpDown size={13} aria-hidden="true"/>}
    </button>
  </th>;
}
