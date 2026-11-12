/**
 * Focused Excel .xlsx reader/writer for the eight columns of DanhSachTaiSan.xlsx.
 * Uses standard Node.js zlib only (no runtime npm spreadsheet dependency).
 * Does not evaluate spreadsheet formulas or execute macros.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { assetError } from './asset-core.js';

export const EXCEL_HEADERS = ['Mã tài sản','Loại tài sản','Tên tài sản','Công ty','Người sử dụng','Giá tiền','Ghi chú','Địa chỉ IP'];
const MAX_COMPRESSED = 12 * 1024 * 1024;
const MAX_XML = 28 * 1024 * 1024;
const MAX_ROWS = 5000;
const encoder = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const decoder = value => String(value ?? '').replace(/&#x([\da-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hx,dec,named)=>{
  if(hx || dec){const n=parseInt(hx||dec,hx?16:10);return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[named.toLowerCase()];
});
function crc32(bytes){
  let value=0xffffffff;
  for(const byte of bytes){value^=byte;for(let i=0;i<8;i++) value=(value>>>1)^((value&1)?0xedb88320:0);}
  return (value^0xffffffff)>>>0;
}
function zipRead(bytes){
  const b=Buffer.from(bytes);
  if(b.length>MAX_COMPRESSED)throw assetError(413,'File Excel vượt quá 12 MB.');
  let eocd=-1;
  for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--){if(b.readUInt32LE(p)===0x06054b50){eocd=p;break;}}
  if(eocd<0)throw assetError(400,'Tệp .xlsx không hợp lệ.');
  const count=b.readUInt16LE(eocd+10),cdStart=b.readUInt32LE(eocd+16);
  if(count>500||cdStart>=b.length)throw assetError(400,'Cấu trúc Excel không hợp lệ.');
  const result=new Map();let pos=cdStart,total=0;
  for(let i=0;i<count;i++){
    if(pos+46>b.length||b.readUInt32LE(pos)!==0x02014b50)throw assetError(400,'ZIP Excel bị hỏng.');
    const flags=b.readUInt16LE(pos+8),method=b.readUInt16LE(pos+10),crc=b.readUInt32LE(pos+16);
    const compressed=b.readUInt32LE(pos+20),uncompressed=b.readUInt32LE(pos+24);
    const nameLen=b.readUInt16LE(pos+28),extraLen=b.readUInt16LE(pos+30),commentLen=b.readUInt16LE(pos+32);
    const offset=b.readUInt32LE(pos+42);
    if(pos+46+nameLen+extraLen+commentLen>b.length||offset+30>b.length||uncompressed===0xffffffff)
      throw assetError(400,'ZIP Excel không hợp lệ hoặc chứa ZIP64.');
    const name=b.toString('utf8',pos+46,pos+46+nameLen).replace(/\\/g,'/');
    pos+=46+nameLen+extraLen+commentLen;
    // Only extract the required OOXML parts, avoiding unnecessary decompression.
    if(!name.startsWith('xl/') || !(name==='xl/workbook.xml'||name==='xl/_rels/workbook.xml.rels'||name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(name)))continue;
    if(flags&1||![0,8].includes(method)||uncompressed>MAX_XML||total+uncompressed>MAX_XML)throw assetError(400,'Excel có nội dung quá lớn hoặc không được hỗ trợ.');
    if(b.readUInt32LE(offset)!==0x04034b50)throw assetError(400,'Lỗi dữ liệu ZIP Excel.');
    const start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28);
    if(start+compressed>b.length)throw assetError(400,'Tệp Excel bị cắt cụt.');
    let raw;
    try{raw=method===8?inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:MAX_XML}):b.subarray(start,start+compressed);}
    catch{throw assetError(400,'Không giải nén được dữ liệu Excel.');}
    if(raw.length!==uncompressed||crc32(raw)!==crc)throw assetError(400,'Dữ liệu Excel bị lỗi CRC hoặc độ dài.');
    total+=raw.length;result.set(name,raw.toString('utf8'));
  }
  return result;
}
const attr=(text,key)=>{const found=String(text).match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`));return found?decoder(found[1]):'';};
const columnIndex=letters=>[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
function textNodes(xml){return [...String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decoder(x[1])).join('');}
function sheetName(files){
  const workbook=files.get('xl/workbook.xml')||'';
  const first=[...workbook.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)];
  const sheet=first.find(x=>attr(x[1],'name')==='Assets')||first[0];
  if(!sheet)return 'xl/worksheets/sheet1.xml';
  const relation=attr(sheet[1],'r:id');
  const rels=files.get('xl/_rels/workbook.xml.rels')||'';
  const m=[...rels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)].find(x=>attr(x[1],'Id')===relation);
  if(!m)return 'xl/worksheets/sheet1.xml';
  const target=attr(m[1],'Target');
  if(target.startsWith('/xl/'))return target.slice(1);
  if(/^worksheets\/sheet\d+\.xml$/.test(target))return 'xl/'+target;
  return 'xl/worksheets/sheet1.xml';
}
export function readAssetExcel(buffer){
  const files=zipRead(buffer);
  const xml=files.get(sheetName(files));
  if(!xml)throw assetError(400,'Không tìm thấy sheet Assets trong Excel.');
  const strings=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(x=>textNodes(x[1]));
  const out=[];
  for(const match of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
    const number=Number(attr(match[1],'r'))||out.length+1;
    if(number>MAX_ROWS+1)throw assetError(400,'Excel tối đa 5.000 dòng dữ liệu.');
    const values=Array(8).fill('');
    for(const cell of match[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const ref=attr(cell[1],'r').match(/^([A-Z]+)\d+$/i);
      if(!ref)continue;
      const col=columnIndex(ref[1].toUpperCase());if(col<0||col>7)continue;
      const type=attr(cell[1],'t');const body=cell[2]||'';
      const cached=(body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)||[])[1];
      let value=type==='inlineStr'?textNodes(body):type==='s'?strings[Number(cached)]??'':cached===undefined?'':decoder(cached);
      if(type==='b')value=value==='1'?'TRUE':'FALSE';
      values[col]=value;
    }
    if(number===1){out[0]=values;continue;}
    if(values.some(v=>String(v).trim()))out.push({row:number,values});
  }
  const header=out[0];
  if(!Array.isArray(header)||header.some((v,i)=>String(v).trim().toLocaleLowerCase('vi')!==EXCEL_HEADERS[i].toLocaleLowerCase('vi')))
    throw assetError(400,`Sheet Assets phải có 8 cột theo mẫu: ${EXCEL_HEADERS.join(' | ')}.`);
  return out.slice(1);
}
function zipWrite(entries){
  const locals=[],centrals=[];let offset=0;
  for(const [name,data] of entries){
    const file=Buffer.from(name,'utf8'),raw=Buffer.from(data,'utf8');const compressed=deflateRawSync(raw);const crc=crc32(raw);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(file.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(file.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,file,compressed);centrals.push(central,file);offset+=local.length+file.length+compressed.length;
  }
  const dir=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,dir,end]);
}
export function writeAssetExcel(rows){
  if(rows.length>MAX_ROWS)throw assetError(413,'Xuất Excel tối đa 5.000 tài sản mỗi lần.');
  const fieldNames=['assetCode','categoryName','assetName','ownerDepartmentName','assignedTo','purchasePrice','description','ipAddress'];
  const all=[EXCEL_HEADERS,...rows.map(r=>fieldNames.map(k=>r[k]??''))];
  let xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  const widths=[23,20,58,22,31,20,49,20];
  xml+='<cols>'+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols><sheetData>';
  for(let r=0;r<all.length;r++){
    xml+=`<row r="${r+1}"${r===0?' ht="27" customHeight="1"':''}>`;
    for(let c=0;c<8;c++){
      const value=all[r][c];const addr=`${String.fromCharCode(65+c)}${r+1}`;
      if(r>0&&c===5&&value!==''&&Number.isFinite(Number(value)))xml+=`<c r="${addr}" s="2"><v>${Number(value)}</v></c>`;
      else xml+=`<c r="${addr}" t="inlineStr" s="${r===0?1:0}"><is><t xml:space="preserve">${encoder(value)}</t></is></c>`;
    }
    xml+='</row>';
  }
  xml+=`</sheetData><autoFilter ref="A1:H${all.length}"/></worksheet>`;
  const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const topRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Assets" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4579"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>';
  return zipWrite([['[Content_Types].xml',types],['_rels/.rels',topRels],['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',wbRels],['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',xml]]);
}
