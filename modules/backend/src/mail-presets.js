// Admin-only portal directory curated from the user's screenshot (19 Nov 2026).
// These are LINK METADATA ONLY: never put usernames, passwords, or vault secrets here.
// Internal IPs without a confirmed URL scheme are intentionally non-clickable.
export const MAIL_CATEGORIES = ['Quản trị mail', 'Webmail', 'Hosting & DNS', 'Hệ thống nội bộ'];

const entries = [
  ['mail-hexa-zimbra','Mail HEXA — Zimbra Admin','https://mail.hexa.vn:7071/zimbraAdmin/','Quản trị mail','Quản trị hệ thống mail HEXA trên Zimbra'],
  ['mail-gdb','Mail GDB — Hosting','https://103.28.36.79:2083','Quản trị mail','Truy cập trang quản trị mail của GDB'],
  ['mail-homie','Mail Nội Thất Homie','https://103.28.39.25:2083/','Quản trị mail','Cổng quản trị hosting / email Homie'],
  ['mail-vietfurniture-admin','Mail Vietfurniture — Admin','https://admin.umail.vn/user','Quản trị mail','Cổng quản lý tài khoản UMail'],
  ['mail-royalmetal','Mail Royalmetal','https://mail.royalmetal.vn:4040/','Webmail','Trang mail Royalmetal — cổng 4040'],
  ['mail-oppein','Mail OPPEIN','https://mail.oppeinhanoi.vn:4040/','Webmail','Trang webmail OPPEIN Hà Nội'],
  ['mail-silkbath','Mail SilkBath','https://mail.silkbath.vn:4040/','Webmail','Trang webmail SilkBath'],
  ['mail-vietfurniture-web','Mail Vietfurniture — Webmail','https://mail.umail.vn/','Webmail','Truy cập hộp thư Vietfurniture / UMail'],
  ['mail-mcomplex','Mail Mcomplex','https://103.28.39.25:2083','Quản trị mail','Cổng quản lý mail Mcomplex (dùng chung địa chỉ IP với Homie)'],
  ['mail-cow','Mail Cow — Domain Admin','https://103.232.120.76/domainadmin/','Quản trị mail','Quản trị domain/mail Cow'],
  ['create-hexa-mail','Tạo mail HEXA','https://103.232.120.76/domainadmin/','Quản trị mail','Cổng tạo tài khoản email HEXA; khác mục Zimbra Admin'],
  ['mail-spam','Bộ lọc spam HEXA','https://mx1.hexa.vn:8008/#spamSpamQuarantine','Quản trị mail','Khu vực cách ly thư rác trên máy chủ mail HEXA'],
  ['server-mail-ip','Máy chủ mail — IP','https://103.232.120.76','Hệ thống nội bộ','Địa chỉ IP máy chủ được ghi trong danh sách'],
  ['camera-admin','Cổng camera / Admin','https://45.117.80.139:4040/admin/','Hệ thống nội bộ','Đường dẫn admin cổng 4040; xác nhận dịch vụ trước khi sử dụng'],
  ['vhost','VHOST — Client Area','https://members.vhost.vn/clientarea/','Hosting & DNS','Quản lý tài khoản hosting VHOST'],
  ['zonedns','ZoneDNS','https://zonedns.vn','Hosting & DNS','Đăng nhập quản trị DNS / tên miền'],
  ['nhanhoa','Nhân Hòa — Customer','https://customer.nhanhoa.com/','Hosting & DNS','Quản lý dịch vụ tại Nhân Hòa'],
  ['scan-internal','Máy scan nội bộ','', 'Hệ thống nội bộ','IP ghi trong ảnh: 192.188.1.82 (Ubuntu). Chưa có URL đầy đủ, vui lòng xác minh địa chỉ'],
  ['internal-device','Thiết bị nội bộ 192.168.2.98','', 'Hệ thống nội bộ','Địa chỉ nội bộ: 192.168.2.98 — chưa xác định giao thức truy cập'],
  ['tplink','TP-Link — Mạng nội bộ','', 'Hệ thống nội bộ','Địa chỉ trong ảnh: 192.168.68.1 (192.168.2.55) — cần kiểm tra IP/giao thức']
];
export const MAIL_LINK_PRESETS = Object.freeze(entries.map(([key,title,url,category,note],index)=>Object.freeze({
  id:`preset_${key.replaceAll('-','_')}`,title,url,category,note,sortIndex:index,username:'',hasPassword:false,isPreset:true
})));
export const MAIL_PRESET_MAP = new Map(MAIL_LINK_PRESETS.map(p=>[p.id,p]));

export function listMailLinks(persisted={}){
  const entries = (persisted&&typeof persisted==='object') ? Object.entries(persisted) : [];
  const byId = new Map(MAIL_LINK_PRESETS.map(p=>[p.id,{...p}]));
  for(const [id,record] of entries){
    if(!record || typeof record!=='object') continue;
    if(record.deleted===true){byId.delete(id);continue;}
    const previous=byId.get(id);
    byId.set(id,{
      ...previous,...record,id,
      isPreset: Boolean(previous?.isPreset),
      hasPassword:Boolean(record.sealed),
      // The ciphertext is never returned by the list API.
      sealed:undefined,
    });
  }
  return [...byId.values()].sort((a,b)=>{
    const x=Number.isFinite(a.sortIndex)?a.sortIndex:1000;
    const y=Number.isFinite(b.sortIndex)?b.sortIndex:1000;
    return x-y || (b.updatedAt||0)-(a.updatedAt||0);
  });
}
