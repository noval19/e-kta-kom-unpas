const $ = id => document.getElementById(id);
let qr = null;

// Isi dengan URL Web App hasil deploy Google Apps Script kamu, contoh:
// https://script.google.com/macros/s/AKfycb.../exec
// Cara mendapatkannya ada di README-sheets.md
const API_BASE = 'https://script.google.com/macros/s/AKfycbzml8TRXLBAZyqzuRL8M7Dxjs3GVP4qZgcuOO3L1d5NMRLan4xc9uhrqq3aK3n_4GA5/exec';

const ORG_NAME = 'Koordinator Olahraga Mahasiswa';
const VALID_UNTIL = 'Seumur Hidup';

let terdaftar = null; // hasil pendaftaran dari Google Sheets: {no_registrasi, ...}

function initials(name){
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'K';
  return parts[0][0].toUpperCase();
}

function setStatus(text, kind){
  const el = $('statusMsg');
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// QR berisi LINK ke Web App Apps Script dengan ?id=<no_registrasi>.
// Saat discan, Apps Script (doGet) langsung mencatat kehadiran ke Google Sheets.
function renderQR(noRegistrasi){
  const url = `${API_BASE}?id=${encodeURIComponent(noRegistrasi)}`;
  $('qrBox').innerHTML = '';
  qr = new QRCode($('qrBox'), {
    text: url,
    width: 100,
    height: 100,
    colorDark: '#0B1B33',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function updateTampilan(){
  const org = ORG_NAME;
  $('orgNameOut').textContent = org;
  $('orgNameOutBack').textContent = org;
  $('emblemLetter').textContent = initials(org);
  $('emblemLetterBack').textContent = initials(org);

  $('outName').textContent = $('fName').value;
  $('outAngkatan').textContent = $('fAngkatan').value;
  $('outJabatan').textContent = $('fJabatan').value;
  $('outValid').textContent = VALID_UNTIL;
  $('outReg').textContent = terdaftar ? terdaftar.no_registrasi : 'Belum terdaftar';
}

// Daftarkan anggota ke Google Sheets lewat Apps Script -> no. registrasi
// dibuat otomatis oleh script, lalu dipakai sebagai isi QR.
//
// Catatan teknis: dikirim dengan Content-Type: text/plain (bukan application/json)
// supaya browser tidak mengirim preflight OPTIONS, karena Apps Script Web App
// tidak menangani preflight itu. Isinya tetap JSON, diparse manual di Apps Script.
async function daftarkanAnggota(){
  const nama = $('fName').value.trim();
  const angkatan = $('fAngkatan').value.trim();
  const jabatan = $('fJabatan').value.trim();

  if(!nama || !angkatan || !jabatan){
    setStatus('Nama, angkatan, dan jabatan wajib diisi.', 'err');
    return;
  }
  if(API_BASE.includes('GANTI_DENGAN_URL')){
    setStatus('Atur dulu API_BASE di script.js dengan URL Web App Apps Script kamu.', 'err');
    return;
  }

  setStatus('Menyimpan ke Google Sheets…', 'pending');
  $('btnRegister').disabled = true;

  try{
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'daftar', nama, angkatan, jabatan })
    });
    const data = await res.json();

    if(data.error){
      setStatus(data.error, 'err');
      return;
    }

    terdaftar = data;
    $('fReg').value = data.no_registrasi;
    updateTampilan();
    renderQR(data.no_registrasi);
    setStatus('Terdaftar sebagai ' + data.no_registrasi + '. QR siap dipakai untuk absen.', 'ok');
  }catch(e){
    setStatus('Gagal terhubung ke Apps Script. Periksa API_BASE dan pengaturan deploy.', 'err');
  }finally{
    $('btnRegister').disabled = false;
  }
}

['fName','fAngkatan','fJabatan'].forEach(id=>{
  $(id).addEventListener('input', ()=>{
    updateTampilan();
    if(terdaftar){
      setStatus('Data berubah — klik "Daftarkan & Buat QR" lagi untuk menyimpan perubahan.', 'pending');
    }
  });
});

$('btnRegister').addEventListener('click', daftarkanAnggota);

$('photoDrop').addEventListener('click', ()=> $('photoInput').click());
$('photoInput').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    $('photoBox').innerHTML = '<img src="'+ev.target.result+'" alt="Foto anggota">';
  };
  reader.readAsDataURL(file);
});

$('btnFlip').addEventListener('click', ()=>{
  $('card').classList.toggle('flipped');
});

$('btnDownload').addEventListener('click', async ()=>{
  if(!terdaftar){
    setStatus('Daftarkan anggota dulu supaya QR absen berfungsi sebelum diunduh.', 'err');
    return;
  }
  const wasFlipped = $('card').classList.contains('flipped');
  $('card').classList.remove('flipped');
  await new Promise(r=>setTimeout(r,50));
  const canvas = await html2canvas($('cardFront'), {scale:3, backgroundColor:null});
  const link = document.createElement('a');
  link.download = 'e-kta-' + terdaftar.no_registrasi.replace(/\s+/g,'-') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  if(wasFlipped) $('card').classList.add('flipped');
});

updateTampilan();
setStatus('Isi data lalu klik "Daftarkan & Buat QR" untuk menyimpan ke Google Sheets.', 'pending');