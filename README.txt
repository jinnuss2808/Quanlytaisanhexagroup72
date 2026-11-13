HEXA — BAT/TAT PHAN HE TICKET (CAP NHAT TREN PROJECT DANG DUNG)

Dat 3 file ngang hang voi frontend/ va backend/:
  APPLY_TICKET_TOGGLE.bat
  APPLY_TICKET_TOGGLE.ps1
  HEXA-TICKET-TOGGLE.patch

Chay APPLY_TICKET_TOGGLE.bat. Cong cu kiem tra code truoc khi ap dung,
sao luu vao thu muc BACKUP ben ngoai repo va chay npm test backend.
Khong chinh sua .env, service-account.json hay du lieu Firebase.

Khi cap nhat xong:
  - Trang /it -> Cau hinh he thong -> Bat/Tat phan he Ticket.
  - Mac dinh Ticket ON, khong thay doi nghiep vu dang chay.
  - Ticket OFF: an danh sach Ticket, thong ke ticket, nhac viec va form gui ticket;
    API tu choi ticket moi/cap nhat ticket (HTTP 403).
  - Quan ly tai san/may in/kho/linh kien van hoat dong binh thuong.
  - Du lieu Ticket cu duoc giu nguyen trong Firebase.
  - Admin bat lai bat cu luc nao.

Neu project da ket noi GitHub va Vercel:
  git add -A
  git commit -m "Add enable disable Ticket module"
  git push origin main

QUAN TRONG: Neu truoc day da deploy Firebase Cloud Functions scheduler
cho thong bao ticket, can deploy lai worker nay thi congtac OFF moi dung
ca lich nhac viec tren cloud. Vi du (bat buoc cai firebase-tools va co quyen):
  cd firebase
  firebase deploy --only functions --project tickethexaa
Bua deploy Functions co the can Firebase Blaze va chi phi. Khong deploy
Database Rules o lan cap nhat nay.

Kiem thu: vao trang Admin, tat Ticket, thu mo URL cong gui yeu cau va
thu POST /api/public/tickets (phai 403), xem Quan ly tai san van binh thuong;
sau do bat Ticket va kiem tra form duoc mo lai.

Khong thay doi code trong repository neu git apply --check that bai:
hay gui log va ma nguon App.jsx/app.js moi nhat de hop nhat an toan.
