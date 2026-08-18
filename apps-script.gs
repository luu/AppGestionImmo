/**
 * CarnetLoc — backend Google Sheets
 * ----------------------------------
 * 1. Ouvrez https://sheets.new pour créer une nouvelle feuille Google Sheets
 *    (ou utilisez une feuille existante).
 * 2. Dans le menu : Extensions > Apps Script.
 * 3. Supprimez le contenu par défaut et collez tout ce fichier.
 * 4. Cliquez sur "Déployer" > "Nouveau déploiement".
 *    - Type : "Application Web"
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 5. Copiez l'URL fournie (se termine par /exec) et collez-la dans
 *    CarnetLoc > Réglages (⚙) > URL du script.
 *
 * Les onglets "Factures", "Activités" et "EtatsDesLieux" sont créés
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
        ['Date', 'Fournisseur', 'Montant (€)', 'Description', 'Bien', 'Enregistré le'],
        [data.date, data.fournisseur, data.montant, data.description, data.bien, new Date()]
      );
    } else if (type === 'activite') {
      appendRow('Activités',
        ['Date', 'Logement', 'Nature', 'Début', 'Fin', 'Commentaire', 'Enregistré le'],
        [data.date, data.lieu, data.nature, data.debut, data.fin, data.commentaire, new Date()]
      );
    } else if (type === 'edl') {
      appendRow('EtatsDesLieux',
        ['Date', 'Logement', 'Type', 'Locataire', 'Nb photos', 'Enregistré le'],
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
