/* ===================== State & storage ===================== */
const DB = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

const KEYS = {
  factures: 'carnetloc_factures',
  activites: 'carnetloc_activites',
  edls: 'carnetloc_edls',
  settings: 'carnetloc_settings',
  edlDraft: 'carnetloc_edl_draft'
};

let settings = DB.get(KEYS.settings, { sheetUrl: '' });
let factures = DB.get(KEYS.factures, []);
let activites = DB.get(KEYS.activites, []);
let edls = DB.get(KEYS.edls, []);
let currentEdl = DB.get(KEYS.edlDraft, null);
let pendingPhoto = null; // temp holder while tagging a photo

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTimeStr = () => new Date().toTimeString().slice(0, 5);
const euro = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ===================== Toast ===================== */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ===================== Tabs ===================== */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.view).classList.add('active');
  });
});

/* ===================== Overlays ===================== */
function openOverlay(id) { document.getElementById(id).classList.add('active'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => b.closest('.overlay').classList.remove('active'))
);

/* ===================== Settings / sync ===================== */
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('inputSheetUrl').value = settings.sheetUrl || '';
  openOverlay('overlaySettings');
});
document.getElementById('btnSaveSettings').addEventListener('click', () => {
  settings.sheetUrl = document.getElementById('inputSheetUrl').value.trim();
  DB.set(KEYS.settings, settings);
  updateSyncBadge();
  toast('Réglages enregistrés');
  closeOverlay('overlaySettings');
});
document.getElementById('btnTestSync').addEventListener('click', async () => {
  if (!settings.sheetUrl) return toast('Renseignez d\'abord l\'URL du script');
  toast('Test en cours…');
  const ok = await pushToSheet('test', { message: 'Connexion CarnetLoc' });
  toast(ok ? 'Connexion OK ✔' : 'Échec — vérifiez l\'URL / le déploiement');
});

function updateSyncBadge() {
  document.getElementById('syncBadge').textContent = settings.sheetUrl ? 'Sheets ✔' : 'hors ligne';
}
updateSyncBadge();

async function pushToSheet(type, data) {
  if (!settings.sheetUrl) return false;
  try {
    const res = await fetch(settings.sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
      body: JSON.stringify({ type, data })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ===================== Dynamic library loader ===================== */
const loaded = {};
function loadScript(src) {
  if (loaded[src]) return loaded[src];
  loaded[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loaded[src];
}

/* ===================== FACTURES ===================== */
const inputPhotoFacture = document.getElementById('inputPhotoFacture');
const inputFileFacture = document.getElementById('inputFileFacture');

document.getElementById('btnScanPhoto').addEventListener('click', () => inputPhotoFacture.click());
document.getElementById('btnScanFile').addEventListener('click', () => inputFileFacture.click());
document.getElementById('btnManualFacture').addEventListener('click', () => openFactureForm());

inputPhotoFacture.addEventListener('change', (e) => handleFactureFile(e.target.files[0]));
inputFileFacture.addEventListener('change', (e) => handleFactureFile(e.target.files[0]));

function openFactureForm(prefill = {}) {
  document.getElementById('factureSheetTitle').textContent = 'Facture';
  document.getElementById('factureOcrStatus').textContent = prefill.ocrNote || '';
  document.getElementById('factDate').value = prefill.date || todayStr();
  document.getElementById('factFournisseur').value = prefill.fournisseur || '';
  document.getElementById('factMontant').value = prefill.montant || '';
  document.getElementById('factDescription').value = prefill.description || '';
  document.getElementById('factBien').value = prefill.bien || '';
  openOverlay('overlayFacture');
}

async function handleFactureFile(file) {
  if (!file) return;
  toast('Lecture de la facture…');
  try {
    let canvas;
    if (file.type === 'application/pdf') {
      canvas = await pdfFirstPageToCanvas(file);
    } else {
      canvas = await imageFileToCanvas(file);
    }
    const text = await ocrCanvas(canvas);
    const guess = guessFactureFields(text);
    openFactureForm({ ...guess, ocrNote: 'Lecture automatique — vérifiez avant d\'enregistrer' });
  } catch (err) {
    console.error(err);
    openFactureForm({ ocrNote: 'Lecture automatique impossible — saisissez les champs' });
  } finally {
    inputPhotoFacture.value = '';
    inputFileFacture.value = '';
  }
}

function imageFileToCanvas(file, maxW = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.onload = () => resolve(downscale(img, maxW)); img.onerror = reject; img.src = reader.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downscale(img, maxW = 1400) {
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function pdfFirstPageToCanvas(file) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

async function ocrCanvas(canvas) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js');
  const { data } = await window.Tesseract.recognize(canvas, 'fra');
  return data.text || '';
}

function guessFactureFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Date: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  let date = '';
  const dateMatch = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dateMatch) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    if (+d <= 31 && +m <= 12) date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Amount: prefer lines mentioning total/ttc, else largest number with 2 decimals
  const amountLines = lines.filter(l => /total|ttc|montant|à payer|a payer/i.test(l));
  const searchIn = amountLines.length ? amountLines.join(' ') : text;
  const amounts = [...searchIn.matchAll(/(\d{1,3}(?:[ .]\d{3})*[,.]\d{2})\s*€?/g)].map(m =>
    parseFloat(m[1].replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
  );
  const montant = amounts.length ? Math.max(...amounts).toFixed(2) : '';
  // Fournisseur: first substantial line (letters, not just numbers)
  const fournisseur = lines.find(l => /[A-Za-zÀ-ÿ]{3,}/.test(l) && !/facture|invoice/i.test(l)) || '';
  const description = lines.slice(0, 3).join(' ').slice(0, 80);
  return { date, montant, fournisseur, description };
}

document.getElementById('btnSaveFacture').addEventListener('click', async () => {
  const rec = {
    id: uid(),
    date: document.getElementById('factDate').value || todayStr(),
    fournisseur: document.getElementById('factFournisseur').value.trim(),
    montant: parseFloat(document.getElementById('factMontant').value) || 0,
    description: document.getElementById('factDescription').value.trim(),
    bien: document.getElementById('factBien').value,
    synced: false
  };
  if (!rec.fournisseur) return toast('Indiquez au moins le fournisseur');
  factures.unshift(rec);
  DB.set(KEYS.factures, factures);
  renderFactures();
  closeOverlay('overlayFacture');
  toast('Facture enregistrée');
  rec.synced = await pushToSheet('facture', rec);
  DB.set(KEYS.factures, factures);
  renderFactures();
});

function renderFactures() {
  const el = document.getElementById('listFactures');
  if (!factures.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">🧾</span>Aucune facture pour l'instant.<br>Scannez-en une pour commencer.</div>`;
    return;
  }
  el.innerHTML = `<div class="card">` + factures.map(f => `
    <div class="entry">
      <div class="entry-main">
        <div class="title">${escapeHtml(f.fournisseur)}</div>
        <div class="sub">${f.date}${f.bien ? ' · ' + escapeHtml(f.bien) : ''}</div>
        <div class="sub">${escapeHtml(f.description || '')}</div>
        <span class="badge ${f.synced ? 'ok' : 'pending'}">${f.synced ? 'synchronisé' : 'non synchronisé'}</span>
      </div>
      <div class="entry-amount">${euro(f.montant)} €</div>
    </div>
  `).join('') + `</div>`;
}

/* ===================== ACTIVITÉS ===================== */
document.getElementById('btnNewActivite').addEventListener('click', () => {
  document.getElementById('actDate').value = todayStr();
  document.getElementById('actDebut').value = '';
  document.getElementById('actFin').value = '';
  document.getElementById('actCommentaire').value = '';
  openOverlay('overlayActivite');
});
document.getElementById('btnActStart').addEventListener('click', () => {
  document.getElementById('actDate').value = todayStr();
  document.getElementById('actDebut').value = nowTimeStr();
});
document.getElementById('btnActStop').addEventListener('click', () => {
  document.getElementById('actFin').value = nowTimeStr();
});
document.getElementById('btnSaveActivite').addEventListener('click', async () => {
  const rec = {
    id: uid(),
    lieu: document.getElementById('actLieu').value,
    nature: document.getElementById('actNature').value,
    date: document.getElementById('actDate').value || todayStr(),
    debut: document.getElementById('actDebut').value,
    fin: document.getElementById('actFin').value,
    commentaire: document.getElementById('actCommentaire').value.trim(),
    synced: false
  };
  activites.unshift(rec);
  DB.set(KEYS.activites, activites);
  renderActivites();
  closeOverlay('overlayActivite');
  toast('Activité enregistrée');
  rec.synced = await pushToSheet('activite', rec);
  DB.set(KEYS.activites, activites);
  renderActivites();
});

function renderActivites() {
  const el = document.getElementById('listActivites');
  if (!activites.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">🕓</span>Aucune activité enregistrée.</div>`;
    return;
  }
  el.innerHTML = `<div class="card">` + activites.map(a => `
    <div class="entry">
      <div class="entry-main">
        <div class="title">${escapeHtml(a.nature)} — ${escapeHtml(a.lieu)}</div>
        <div class="sub">${a.date} ${a.debut ? '· ' + a.debut : ''}${a.fin ? ' → ' + a.fin : ''}</div>
        ${a.commentaire ? `<div class="sub">${escapeHtml(a.commentaire)}</div>` : ''}
        <span class="badge ${a.synced ? 'ok' : 'pending'}">${a.synced ? 'synchronisé' : 'non synchronisé'}</span>
      </div>
    </div>
  `).join('') + `</div>`;
}

/* ===================== ÉTAT DES LIEUX ===================== */
document.getElementById('btnNewEdl').addEventListener('click', () => {
  document.getElementById('edlDate').value = todayStr();
  document.getElementById('edlLocataire').value = '';
  openOverlay('overlayEdlNew');
});

document.getElementById('btnStartEdl').addEventListener('click', () => {
  currentEdl = {
    id: uid(),
    lieu: document.getElementById('edlLieu').value,
    type: document.getElementById('edlType').value,
    locataire: document.getElementById('edlLocataire').value.trim(),
    date: document.getElementById('edlDate').value || todayStr(),
    photos: []
  };
  DB.set(KEYS.edlDraft, currentEdl);
  closeOverlay('overlayEdlNew');
  openEdlSession();
});

function openEdlSession() {
  document.getElementById('edlSessionTitle').textContent = `${currentEdl.type} — ${currentEdl.lieu}`;
  document.getElementById('edlSessionSub').textContent =
    `${currentEdl.locataire ? currentEdl.locataire + ' · ' : ''}${currentEdl.date}`;
  renderEdlPhotoGrid();
  openOverlay('overlayEdlSession');
}

const inputEdlPhoto = document.getElementById('inputEdlPhoto');
document.getElementById('btnEdlAddPhoto').addEventListener('click', () => inputEdlPhoto.click());
inputEdlPhoto.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  inputEdlPhoto.value = '';
  if (!file) return;
  const canvas = await imageFileToCanvas(file, 1280);
  pendingPhoto = canvas.toDataURL('image/jpeg', 0.72);
  document.getElementById('photoTagPreview').src = pendingPhoto;
  document.getElementById('photoTagRoom').value = 'Salon';
  document.getElementById('photoTagComment').value = '';
  closeOverlay('overlayEdlSession');
  openOverlay('overlayPhotoTag');
});

document.getElementById('btnConfirmPhotoTag').addEventListener('click', () => {
  currentEdl.photos.push({
    id: uid(),
    room: document.getElementById('photoTagRoom').value,
    comment: document.getElementById('photoTagComment').value.trim(),
    dataUrl: pendingPhoto
  });
  DB.set(KEYS.edlDraft, currentEdl);
  pendingPhoto = null;
  closeOverlay('overlayPhotoTag');
  openEdlSession();
});
document.querySelectorAll('[data-close-photo]').forEach(b => b.addEventListener('click', () => {
  pendingPhoto = null;
  closeOverlay('overlayPhotoTag');
  openEdlSession();
}));

function renderEdlPhotoGrid() {
  const el = document.getElementById('edlPhotoGrid');
  if (!currentEdl.photos.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="big">📷</span>Ajoutez une première photo.</div>`;
    return;
  }
  el.innerHTML = currentEdl.photos.map(p => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}">
      <button class="del" data-del="${p.id}">✕</button>
      <div class="room-tag">${escapeHtml(p.room)}</div>
    </div>
  `).join('');
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
    currentEdl.photos = currentEdl.photos.filter(p => p.id !== btn.dataset.del);
    DB.set(KEYS.edlDraft, currentEdl);
    renderEdlPhotoGrid();
  }));
}

document.getElementById('btnFinishEdl').addEventListener('click', async () => {
  if (!currentEdl.photos.length) return toast('Ajoutez au moins une photo avant de terminer');
  const summary = {
    id: currentEdl.id,
    lieu: currentEdl.lieu,
    type: currentEdl.type,
    locataire: currentEdl.locataire,
    date: currentEdl.date,
    nbPhotos: currentEdl.photos.length,
    synced: false
  };
  edls.unshift(summary);
  DB.set(KEYS.edls, edls);
  generateEdlReport(currentEdl);
  renderEdlList();
  closeOverlay('overlayEdlSession');
  toast('Compte-rendu généré dans un nouvel onglet');
  summary.synced = await pushToSheet('edl', summary);
  DB.set(KEYS.edls, edls);
  renderEdlList();
  currentEdl = null;
  localStorage.removeItem(KEYS.edlDraft);
});

function generateEdlReport(edl) {
  const rooms = {};
  edl.photos.forEach(p => { (rooms[p.room] ||= []).push(p); });
  const roomHtml = Object.entries(rooms).map(([room, photos]) => `
    <section style="margin-bottom:28px;">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:18px;border-bottom:2px solid #D98E2B;padding-bottom:6px;">${escapeHtml(room)}</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:12px;">
        ${photos.map(p => `
          <figure style="margin:0;">
            <img src="${p.dataUrl}" style="width:100%;border-radius:8px;border:1px solid #ddd;">
            ${p.comment ? `<figcaption style="font-size:13px;color:#555;margin-top:4px;">${escapeHtml(p.comment)}</figcaption>` : ''}
          </figure>
        `).join('')}
      </div>
    </section>
  `).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>État des lieux — ${escapeHtml(edl.lieu)}</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;color:#1B1A17;max-width:800px;margin:0 auto;padding:28px;}
    header{margin-bottom:24px;}
    h1{font-family:'Space Grotesk',sans-serif;font-size:26px;margin:0 0 6px;}
    .meta{color:#555;font-size:14px;}
    .controls{margin:18px 0;display:flex;gap:10px;}
    button{font-family:Inter,sans-serif;font-weight:600;padding:10px 16px;border-radius:8px;border:1px solid #D98E2B;background:#D98E2B;color:#1B1A17;cursor:pointer;}
    button.secondary{background:#fff;color:#1B1A17;}
    @media print { .controls{display:none;} }
  </style></head><body>
    <header>
      <h1>État des lieux — ${escapeHtml(edl.type)}</h1>
      <div class="meta">${escapeHtml(edl.lieu)}${edl.locataire ? ' · Locataire : ' + escapeHtml(edl.locataire) : ''} · ${edl.date}</div>
    </header>
    <div class="controls">
      <button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
      <button class="secondary" onclick="navigator.clipboard.writeText(document.title + ' — ' + document.querySelector('.meta').innerText).then(()=>alert('Résumé copié'))">Copier le résumé</button>
    </div>
    ${roomHtml}
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function renderEdlList() {
  const el = document.getElementById('listEdl');
  if (!edls.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">🏠</span>Aucun état des lieux réalisé.</div>`;
    return;
  }
  el.innerHTML = `<div class="card">` + edls.map(e => `
    <div class="entry">
      <div class="entry-main">
        <div class="title">${escapeHtml(e.type)} — ${escapeHtml(e.lieu)}</div>
        <div class="sub">${e.date}${e.locataire ? ' · ' + escapeHtml(e.locataire) : ''} · ${e.nbPhotos} photo(s)</div>
        <span class="badge ${e.synced ? 'ok' : 'pending'}">${e.synced ? 'synchronisé' : 'non synchronisé'}</span>
      </div>
    </div>
  `).join('') + `</div>`;
}

/* Resume an EDL draft left mid-session (e.g. app was closed) */
if (currentEdl) {
  toast('Reprise de l\'état des lieux en cours');
}

/* ===================== Utils ===================== */
function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ===================== Init ===================== */
renderFactures();
renderActivites();
renderEdlList();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
