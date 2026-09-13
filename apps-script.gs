/**
 * CarnetLoc â€” backend Google Sheets
 * ----------------------------------
 * 1. Ouvrez https://sheets.new pour crÃ©er une nouvelle feuille Google Sheets
 *    (ou utilisez une feuille existante).
 * 2. Dans le menu : Extensions > Apps Script.
 * 3. Supprimez le contenu par dÃ©faut et collez tout ce fichier.
 * 4. Cliquez sur "DÃ©ployer" > "Nouveau dÃ©ploiement".
 *    - Type : "Application Web"
 *    - ExÃ©cuter en tant que : Moi
 *    - Qui a accÃ¨s : Tout le monde
 * 5. Copiez l'URL fournie (se termine par /exec) et collez-la dans
 *    CarnetLoc > RÃ©glages (âš™) > URL du script.
 *
 * Les onglets "Factures", "ActivitÃ©s" et "EtatsDesLieux" sont crÃ©Ã©s
 * automatiquement au premier envoi.
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type;
    const data = payload.data || {};

    if (type === 'test') {
      return respond({ ok: true, message: 'Connexion CarnetLoc OK' });
    }

    if (type === 'facture') {
      appendRow('Factures',
        ['Date', 'Fournisseur', 'Montant (â‚¬)', 'Description', 'Bien', 'EnregistrÃ© le'],
        [data.date, data.fournisseur, data.montant, data.description, data.bien, new Date()]
      );
    } else if (type === 'activite') {
      appendRow('ActivitÃ©s',
        ['Date', 'Logement', 'Nature', 'DÃ©but', 'Fin', 'Commentaire', 'EnregistrÃ© le'],
        [data.date, data.lieu, data.nature, data.debut, data.fin, data.commentaire, new Date()]
      );
    } else if (type === 'edl') {
      appendRow('EtatsDesLieux',
        ['Date', 'Logement', 'Type', 'Locataire', 'Nb photos', 'EnregistrÃ© le'],
        [data.date, data.lieu, data.type, data.locataire, data.nbPhotos, new Date()]
      );
    } else {
      return respond({ ok: false, error: 'type inconnu' });
    }

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function doGet() {
  return respond({ ok: true, message: 'CarnetLoc backend actif' });
}

function appendRow(sheetName, headers, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow(row);
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
