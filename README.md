# CarnetLoc

Application simple pour gérer vos locations : factures, suivi d'activités, états des lieux.
C'est une **PWA** (application web installable) : pas de Play Store, pas de build Android — elle s'installe directement depuis Chrome sur votre Pixel 7 Pro.

Stockage : localement sur le téléphone (fonctionne hors ligne) + synchronisation automatique vers **Google Sheets** via un petit script gratuit (Google Apps Script). Aucune base de données à héberger.

---

## 1. Mettre en ligne les fichiers (5 minutes, gratuit)

Une PWA doit être servie en HTTPS pour être installable. La méthode la plus simple sans compte ni ligne de commande :

1. Allez sur **https://app.netlify.com/drop**
2. Glissez-déposez tout le dossier `carnetloc` (celui qui contient `index.html`) dans la zone de dépôt.
3. Netlify vous donne une URL du type `https://une-adresse.netlify.app` — c'est votre app, déjà en ligne.

*Alternative durable :* déposez les mêmes fichiers dans un dépôt GitHub et activez **GitHub Pages** (Settings > Pages) — vous aurez une URL stable que vous pourrez retrouver plus tard.

## 2. Créer la feuille Google Sheets (2 minutes)

1. Ouvrez **https://sheets.new** — cela crée une nouvelle feuille.
2. Menu **Extensions > Apps Script**.
3. Effacez le contenu, collez celui du fichier `apps-script.gs` fourni.
4. **Déployer > Nouveau déploiement > Application Web**
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
5. Copiez l'URL qui se termine par `/exec`.

Les onglets *Factures*, *Activités* et *EtatsDesLieux* se créent automatiquement dans la feuille dès le premier envoi.

## 3. Installer sur le Pixel 7 Pro

1. Ouvrez **Chrome** sur le téléphone et allez sur l'URL Netlify de l'étape 1.
2. Appuyez sur le menu **⋮** (en haut à droite) > **"Installer l'application"** (ou "Ajouter à l'écran d'accueil").
3. L'icône CarnetLoc apparaît sur l'écran d'accueil, comme une app normale, en plein écran.
4. Ouvrez l'app, appuyez sur **⚙ Réglages**, collez l'URL `/exec` obtenue à l'étape 2, puis **Enregistrer**. Utilisez "Tester la connexion" pour vérifier.

C'est prêt. Les 3 fonctionnalités sont accessibles par les onglets en bas de l'écran.

---

## Comment ça marche

- **Factures** : la photo ou le PDF n'est jamais conservé — l'app lit le texte sur l'appareil (reconnaissance de caractères embarquée), essaie de deviner la date, le fournisseur et le montant, puis vous laissez vérifier/corriger avant d'enregistrer. Seules les informations texte (date, montant, fournisseur, description, bien) sont envoyées dans Google Sheets.
- **Activités** : boutons "Démarrer" / "Terminer" pour horodater rapidement, ou saisie manuelle des heures. Chaque activité (entretien, réparation, visite, état d'entrée/sortie) est listée et envoyée dans l'onglet *Activités*.
- **États des lieux** : vous prenez les photos pièce par pièce avec un commentaire court. À la fin, l'app ouvre un compte-rendu (page HTML imprimable) avec toutes les photos groupées par pièce — bouton "Imprimer / Enregistrer en PDF" pour obtenir un fichier à envoyer au locataire par mail ou messagerie. Les photos restent sur le téléphone ; seul un résumé (logement, type, locataire, date, nombre de photos) est envoyé dans Google Sheets pour garder une trace.

## Fonctionnement hors connexion

Toutes les données sont d'abord enregistrées sur le téléphone (badge "non synchronisé" si le réseau est absent). Dès que vous avez du réseau, rouvrez l'app ou ressaisissez une entrée : la synchronisation se retente automatiquement à chaque nouvel enregistrement.

## Modifier les logements

Les trois logements (Maison Bezons, Appartement Bezons, Appartement Chatou) sont codés dans `index.html`, dans les listes déroulantes `<select>` des sections Activités et État des lieux. Pour ajouter/renommer un bien, cherchez les blocs `<option>Maison Bezons</option>` etc. et modifiez-les, puis redéposez le dossier sur Netlify Drop (ou remplacez les fichiers sur GitHub Pages).
