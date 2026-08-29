const body = document.body;
const cover = document.getElementById('cover');
const main = document.getElementById('mainContent');
const openBtn = document.getElementById('openInvitation');
const music = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const guestName = document.getElementById('guestName');
const toast = document.getElementById('toast');

const params = new URLSearchParams(location.search);
const guest = params.get('to');
if (guest && guest.trim()) guestName.textContent = guest.trim();

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function startMusic() {
  try {
    await music.play();
    musicBtn.classList.add('is-playing');
    musicBtn.setAttribute('aria-label', 'Jeda musik');
  } catch (_) {
    musicBtn.classList.remove('is-playing');
  }
}

openBtn.addEventListener('click', () => {
  cover.classList.add('is-opening');
  startMusic();
  setTimeout(() => {
    body.classList.remove('locked');
    main.removeAttribute('inert');
    document.querySelector('.hero .reveal')?.classList.add('is-visible');
  }, 140);
  setTimeout(() => cover.classList.add('is-open'), 860);
});

musicBtn.addEventListener('click', async () => {
  if (music.paused) await startMusic();
  else {
    music.pause();
    musicBtn.classList.remove('is-playing');
    musicBtn.setAttribute('aria-label', 'Putar musik');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.16, rootMargin: '0px 0px -5% 0px' });

document.querySelectorAll('.reveal').forEach(el => {
  if (!el.classList.contains('is-visible')) observer.observe(el);
});

const parallaxLayers = [...document.querySelectorAll('[data-parallax]')];
let ticking = false;
function updateParallax() {
  parallaxLayers.forEach(layer => {
    const rect = layer.parentElement.getBoundingClientRect();
    const factor = Number(layer.dataset.parallax || 0);
    const relative = (innerHeight / 2 - (rect.top + rect.height / 2));
    layer.style.setProperty('--scrollY', `${relative * factor}px`);
    layer.style.translate = `0 ${relative * factor}px`;
  });
  ticking = false;
}
addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(updateParallax);
    ticking = true;
  }
}, { passive: true });
addEventListener('resize', updateParallax);

const target = new Date('2026-10-02T08:00:00+07:00').getTime();
function updateCountdown() {
  let diff = Math.max(0, target - Date.now());
  const d = Math.floor(diff / 86400000); diff %= 86400000;
  const h = Math.floor(diff / 3600000); diff %= 3600000;
  const m = Math.floor(diff / 60000); diff %= 60000;
  const s = Math.floor(diff / 1000);
  document.getElementById('days').textContent = String(d).padStart(2,'0');
  document.getElementById('hours').textContent = String(h).padStart(2,'0');
  document.getElementById('minutes').textContent = String(m).padStart(2,'0');
  document.getElementById('seconds').textContent = String(s).padStart(2,'0');
}
updateCountdown(); setInterval(updateCountdown,1000);

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      showToast('Nomor rekening berhasil disalin');
    } catch (_) {
      showToast('Silakan salin nomor rekening secara manual');
    }
  });
});

const rsvpForm = document.getElementById('rsvpForm');
const rsvpPhoto = document.getElementById('rsvpPhoto');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewImg = document.getElementById('photoPreviewImg');
const removePhotoBtn = document.getElementById('removePhoto');
const recordVoiceBtn = document.getElementById('recordVoice');
const stopVoiceBtn = document.getElementById('stopVoice');
const recordTimer = document.getElementById('recordTimer');
const voicePreview = document.getElementById('voicePreview');
const removeVoiceBtn = document.getElementById('removeVoice');
const wishList = document.getElementById('wishList');
const wishEmpty = document.getElementById('wishEmpty');
const wishPagination = document.getElementById('wishPagination');
const WISHES_PER_PAGE = 5;
let wishCurrentPage = 1;
let wishBlobUrls = [];

let selectedPhotoBlob = null;
let recordedAudioBlob = null;
let mediaRecorder = null;
let mediaStream = null;
let voiceChunks = [];
let recordInterval = null;
let recordStartedAt = 0;

function openWishDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('irfan-sinta-wishes', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('wishes')) {
        db.createObjectStore('wishes', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveWish(entry) {
  const db = await openWishDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wishes', 'readwrite');
    tx.objectStore('wishes').add(entry);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getWishes() {
  const db = await openWishDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wishes', 'readonly');
    const request = tx.objectStore('wishes').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

function blobUrl(blob) {
  return blob ? URL.createObjectURL(blob) : '';
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '♡';
}

function formatWishDate(iso) {
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch (_) { return ''; }
}

function clearWishBlobUrls() {
  wishBlobUrls.forEach(url => URL.revokeObjectURL(url));
  wishBlobUrls = [];
}

function wishBlobUrl(blob) {
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  wishBlobUrls.push(url);
  return url;
}

function renderWishPagination(totalPages) {
  if (!wishPagination) return;
  wishPagination.innerHTML = '';
  wishPagination.hidden = totalPages <= 1;
  if (totalPages <= 1) return;

  const makeButton = (label, page, options = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wish-page-btn';
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    if (options.current) {
      button.classList.add('is-current');
      button.setAttribute('aria-current', 'page');
    }
    if (options.label) button.setAttribute('aria-label', options.label);
    button.addEventListener('click', () => {
      if (button.disabled || page === wishCurrentPage) return;
      wishCurrentPage = page;
      renderWishes();
      document.getElementById('wishesTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return button;
  };

  wishPagination.appendChild(makeButton('‹', Math.max(1, wishCurrentPage - 1), {
    disabled: wishCurrentPage === 1,
    label: 'Halaman sebelumnya'
  }));

  let pages = [];
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (wishCurrentPage > 4) pages.push('…');
    const from = Math.max(2, wishCurrentPage - 1);
    const to = Math.min(totalPages - 1, wishCurrentPage + 1);
    for (let page = from; page <= to; page++) pages.push(page);
    if (wishCurrentPage < totalPages - 3) pages.push('…');
    pages.push(totalPages);
  }

  pages.forEach(page => {
    if (page === '…') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'wish-page-ellipsis';
      ellipsis.textContent = '…';
      wishPagination.appendChild(ellipsis);
    } else {
      wishPagination.appendChild(makeButton(String(page), page, {
        current: page === wishCurrentPage,
        label: `Halaman ${page}`
      }));
    }
  });

  wishPagination.appendChild(makeButton('›', Math.min(totalPages, wishCurrentPage + 1), {
    disabled: wishCurrentPage === totalPages,
    label: 'Halaman berikutnya'
  }));
}

async function renderWishes() {
  if (!wishList) return;
  let wishes = [];
  try { wishes = await getWishes(); } catch (_) { wishes = []; }
  wishes.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  const totalPages = Math.max(1, Math.ceil(wishes.length / WISHES_PER_PAGE));
  wishCurrentPage = Math.min(Math.max(1, wishCurrentPage), totalPages);
  const startIndex = (wishCurrentPage - 1) * WISHES_PER_PAGE;
  const pageWishes = wishes.slice(startIndex, startIndex + WISHES_PER_PAGE);

  clearWishBlobUrls();
  wishList.innerHTML = '';
  wishEmpty.hidden = wishes.length > 0;

  pageWishes.forEach(wish => {
    const card = document.createElement('article');
    card.className = 'wish-card reveal is-visible';

    const head = document.createElement('div');
    head.className = 'wish-card__head';
    const avatar = document.createElement('div');
    avatar.className = 'wish-avatar';
    if (wish.photo) {
      const img = document.createElement('img');
      img.src = wishBlobUrl(wish.photo);
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(wish.name);
    }
    const meta = document.createElement('div');
    meta.className = 'wish-meta';
    const name = document.createElement('strong');
    name.className = 'wish-name';
    name.textContent = wish.name || 'Tamu';
    const attend = document.createElement('span');
    attend.className = 'wish-attendance';
    attend.textContent = wish.attendance || '';
    meta.append(name, attend);
    head.append(avatar, meta);
    card.appendChild(head);

    const message = document.createElement('p');
    message.className = 'wish-message';
    message.textContent = wish.message || '';
    card.appendChild(message);

    if (wish.photo) {
      const img = document.createElement('img');
      img.className = 'wish-photo';
      img.src = wishBlobUrl(wish.photo);
      img.alt = `Foto dari ${wish.name || 'tamu'}`;
      card.appendChild(img);
    }
    if (wish.audio) {
      const audio = document.createElement('audio');
      audio.className = 'wish-audio';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = wishBlobUrl(wish.audio);
      card.appendChild(audio);
    }
    const date = document.createElement('small');
    date.className = 'wish-date';
    date.textContent = formatWishDate(wish.savedAt);
    card.appendChild(date);
    wishList.appendChild(card);
  });

  renderWishPagination(totalPages);
}

async function compressPhoto(file) {
  if (!file) return null;
  if (file.size <= 1800000) return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', .82));
}

rsvpPhoto?.addEventListener('change', async () => {
  const file = rsvpPhoto.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('File harus berupa foto');
  if (file.size > 8000000) return showToast('Ukuran foto maksimal 8 MB');
  selectedPhotoBlob = await compressPhoto(file);
  photoPreviewImg.src = blobUrl(selectedPhotoBlob);
  photoPreview.hidden = false;
});

removePhotoBtn?.addEventListener('click', () => {
  selectedPhotoBlob = null;
  if (rsvpPhoto) rsvpPhoto.value = '';
  photoPreview.hidden = true;
  photoPreviewImg.removeAttribute('src');
});

function stopMediaStream() {
  mediaStream?.getTracks().forEach(track => track.stop());
  mediaStream = null;
}

function resetRecordTimer() {
  clearInterval(recordInterval);
  recordInterval = null;
  recordTimer.textContent = '00:00';
}

recordVoiceBtn?.addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast('Browser ini belum mendukung rekam suara');
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    const preferred = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t => MediaRecorder.isTypeSupported?.(t));
    mediaRecorder = preferred ? new MediaRecorder(mediaStream, { mimeType: preferred }) : new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = e => { if (e.data?.size) voiceChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      recordedAudioBlob = new Blob(voiceChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      voicePreview.src = blobUrl(recordedAudioBlob);
      voicePreview.hidden = false;
      removeVoiceBtn.hidden = false;
      recordVoiceBtn.classList.remove('is-recording');
      recordVoiceBtn.disabled = false;
      stopVoiceBtn.disabled = true;
      stopMediaStream();
      resetRecordTimer();
    };
    mediaRecorder.start(250);
    recordStartedAt = Date.now();
    recordVoiceBtn.classList.add('is-recording');
    recordVoiceBtn.disabled = true;
    stopVoiceBtn.disabled = false;
    recordInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordStartedAt) / 1000);
      recordTimer.textContent = `00:${String(seconds).padStart(2, '0')}`;
      if (seconds >= 60 && mediaRecorder?.state === 'recording') mediaRecorder.stop();
    }, 500);
  } catch (_) {
    showToast('Izin mikrofon tidak diberikan');
    stopMediaStream();
  }
});

stopVoiceBtn?.addEventListener('click', () => {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
});

removeVoiceBtn?.addEventListener('click', () => {
  recordedAudioBlob = null;
  voicePreview.hidden = true;
  voicePreview.pause();
  voicePreview.removeAttribute('src');
  removeVoiceBtn.hidden = true;
  resetRecordTimer();
});

rsvpForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(rsvpForm));
  const entry = {
    name: String(data.name || '').trim(),
    attendance: String(data.attendance || ''),
    message: String(data.message || '').trim(),
    photo: selectedPhotoBlob,
    audio: recordedAudioBlob,
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem('irfan-sinta-rsvp', JSON.stringify({ name: entry.name, attendance: entry.attendance, message: entry.message, savedAt: entry.savedAt }));
    await saveWish(entry);
    document.getElementById('rsvpNotice').textContent = 'Konfirmasi dan ucapan tersimpan di perangkat ini. Terima kasih.';
    rsvpForm.reset();
    selectedPhotoBlob = null;
    recordedAudioBlob = null;
    photoPreview.hidden = true;
    voicePreview.hidden = true;
    removeVoiceBtn.hidden = true;
    resetRecordTimer();
    wishCurrentPage = 1;
    await renderWishes();
    document.querySelector('.wishes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (_) {
    document.getElementById('rsvpNotice').textContent = 'Gagal menyimpan. Coba lagi.';
  }
});

renderWishes();

const petalField = document.getElementById('petalField');
for (let i = 0; i < 28; i++) {
  const petal = document.createElement('span');
  petal.className = 'petal';
  petal.style.left = `${Math.random() * 100}%`;
  petal.style.animationDuration = `${8 + Math.random() * 9}s`;
  petal.style.animationDelay = `${-Math.random() * 15}s`;
  petal.style.setProperty('--drift', `${-70 + Math.random() * 140}px`);
  petal.style.opacity = `${.22 + Math.random() * .46}`;
  petal.style.scale = `${.65 + Math.random() * .8}`;
  petalField.appendChild(petal);
}


// Add to calendar
const addToCalendarBtn = document.getElementById('addToCalendar');

function buildWeddingIcs() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const description = [
    'Pernikahan Irfan & Sinta',
    '',
    'Akad Nikah: 08.00 WIB',
    'Lokasi: Rumah Mempelai Wanita, Dsn. Jeruk RT/RW 001/008, Ds. Jabon, Kalidawir, Tulungagung.',
    '',
    'Resepsi: 13.00 WIB - Selesai',
    'Lokasi: Rumah Mempelai Pria, Dsn. Mekarsari RT/RW 005/002, Ds. Tunggulsari, Kedungwaru, Tulungagung.'
  ].join('\n').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Irfan & Sinta//Wedding Invitation//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:irfan-sinta-20261002@wedding',
    `DTSTAMP:${stamp}`,
    'DTSTART;TZID=Asia/Jakarta:20261002T080000',
    'DTEND;TZID=Asia/Jakarta:20261002T200000',
    'SUMMARY:Pernikahan Irfan & Sinta',
    'LOCATION:Tulungagung, Jawa Timur',
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Besok adalah pernikahan Irfan & Sinta',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function openGoogleCalendar() {
  const title = encodeURIComponent('Pernikahan Irfan & Sinta');
  const dates = '20261002T010000Z/20261002T130000Z';
  const details = encodeURIComponent(
    'Akad Nikah 08.00 WIB di Rumah Mempelai Wanita, Dsn. Jeruk, Jabon, Kalidawir, Tulungagung.\n\n' +
    'Resepsi 13.00 WIB - Selesai di Rumah Mempelai Pria, Dsn. Mekarsari, Tunggulsari, Kedungwaru, Tulungagung.'
  );
  const locationText = encodeURIComponent('Tulungagung, Jawa Timur');
  window.open(
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${locationText}`,
    '_blank',
    'noopener'
  );
}

function downloadIcs() {
  const a = document.createElement('a');
  a.href = 'assets/calendar/Pernikahan-Irfan-Sinta.ics';
  a.download = 'Pernikahan-Irfan-Sinta.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

if (addToCalendarBtn) {
  addToCalendarBtn.addEventListener('click', () => {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
    if (isAppleMobile) {
      downloadIcs();
      showToast('Buka file kalender lalu pilih Tambah');
    } else {
      openGoogleCalendar();
    }
  });
}
