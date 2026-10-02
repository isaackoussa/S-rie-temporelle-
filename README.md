# Atelier Séries Temporelles

Application web pédagogique sur les séries temporelles, de l’explication à la pratique : théorie formalisée,
simulations interactives, et un laboratoire qui analyse vos propres données jusqu’à la prévision.

Tout est calculé dans le navigateur par un moteur numérique écrit pour l’occasion (`js/stats.js`, sans
dépendance). Chaque chapitre se termine par le code R équivalent (packages `forecast`, `tseries`, `urca`) et un quiz.
Les séries de l’atelier sont écrites en clair dans le code R généré (AirPassengers est fourni par R) : il s’exécute tel quel.

## Lancer

Aucune installation. Servez le dossier avec n’importe quel serveur statique :

```bash
python3 -m http.server 8000          # ou, depuis R : servr::httd()
# puis ouvrir http://localhost:8000
```

Ouvrir `index.html` directement (file://) fonctionne aussi, sans l’installation ni le mode hors ligne.

## Installer comme application

L’atelier est une application web installable (PWA) : icône sur l’écran d’accueil, fenêtre dédiée,
fonctionnement hors ligne (`manifest.webmanifest`, `sw.js`, icônes dans `icons/`).

1. Publier le site : sur GitHub, **Settings → Pages → Branch : `main`, dossier `/ (root)`**. L’adresse sera
   `https://<utilisateur>.github.io/S-rie-temporelle-/`.
2. Ouvrir cette adresse puis :
   - **Android / Chrome** : menu ⋮ → *Installer l’application* (ou le bouton « Installer l’application » du menu de l’atelier) ;
   - **iPhone / iPad (Safari)** : *Partager* → *Sur l’écran d’accueil* ;
   - **Ordinateur (Chrome, Edge)** : icône d’installation à droite de la barre d’adresse.

Après une modification des fichiers, incrémentez `VERSION` dans `sw.js` pour que les appareils déjà
installés récupèrent la nouvelle version.

## Chapitres

| t | Chapitre | Contenu technique | Pratique interactive |
|---|----------|-------------------|----------------------|
| 0 | Introduction | processus stochastique, ergodicité, opérateur retard, bruit blanc | AirPassengers |
| 1 | Anatomie & décomposition | modèles additif / multiplicatif, 2×m-MA, forces F_T et F_S | décomposition, générateur de séries |
| 2 | Stationnarité & tests | stationnarité stricte/faible, racine unitaire, ADF, KPSS, Box-Cox | galerie de processus (dont GARCH), tests en direct |
| 3 | ACF, PACF & spectre | estimateurs, bandes de Bartlett, Durbin-Levinson, Ljung-Box, périodogramme | corrélogrammes, déroulé de Durbin-Levinson |
| 4 | Modèles AR, MA, ARMA | causalité, inversibilité, poids ψ, Wold, triangle AR(2) | simulateur ARMA(2,2), racines dans le plan complexe |
| 5 | Lissage exponentiel | SES, Holt, amortissement, Holt-Winters, ETS, variance de prévision | ajustement optimisé ou manuel, composantes |
| 6 | Box-Jenkins & SARIMA | CSS, reparamétrisation de Jones, hessien, AIC/AICc/BIC, diagnostic | estimation, recherche auto, diagnostic des résidus |
| 7 | Évaluation & validation | MAE, RMSE, MAPE, MASE, couverture, origine glissante | comparaison de 6 modèles, erreur par horizon |
| 8 | Labo : vos données | pipeline complet | import CSV, choix automatique, prévision exportable, script R |
| 9 | Études de cas | 4 analyses complètes commentées étape par étape : AirPassengers (Box-Jenkins), ventes additives à vérité connue, charge électrique journalière, marche aléatoire et régression fallacieuse | chiffres recalculés en direct, code R par étape |
| 10 | Exercices appliqués | identification ARMA, diagnostic de stationnarité, calculs à la main, défi de prévision sur données cachées | énoncés aléatoires, corrections détaillées, score |

## Page « Cours M2 GRAF » (`cours-m2graf.html`)

Le support de cours *Introduction aux séries temporelles* (Master 2 GRAF, IUA) en version interactive : même plan
(chapitres 1, 3, 5, 7, 8, 10 et TP 1 à 5), mêmes notations (a_j, b_j, x̂_{n,h}, σ(h), r(h), Δ_T, SARIMA_{p,d,q,T}).

- les 20 exercices du support corrigés (corrections dépliables) et les 5 TP rédigés comme des comptes-rendus ;
- les séries de R utilisées par le cours (`USAccDeaths`, `sunspot.year`, `co2`, `EuStockMarkets`) intégrées valeur pour valeur ;
- Holt-Winters calculé exactement comme `stats::HoltWinters` (initialisation, constantes, intervalles de prévision) ;
- ARCH/GARCH estimés par maximum de vraisemblance, résultats conformes à `tseries::garch` ;
- un encadré « Points d’attention » signale les coquilles du support (mise à jour de la pente du lissage double en α²,
  pénalité du BIC en ν log n, algorithme de Durbin-Levinson, carré manquant dans la variance conditionnelle).

Les fichiers des TP sont dans `donnees/` (voir ci-dessous) ; `sanfran.dat` et `UKinterestrates.dat`, introuvables,
sont remplacés par de vraies séries de même nature, signalées comme substituts.

## Console R (`console-r.html`)

Un vrai R (4.x) qui tourne dans le navigateur grâce à [webR](https://docs.r-wasm.org/webr/latest/) (R compilé en
WebAssembly), pensé pour le téléphone :

- onglets **Script** (éditeur, « Tout exécuter », « Ligne / sélection », Ctrl+Entrée) et **Console** (invite `>`,
  saisie sur plusieurs lignes avec `+`, historique ↑/↓) ; côte à côte sur grand écran ;
- barre de touches R au-dessus du clavier : `<-`, `|>`, parenthèses, crochets, `$`, `~`, `#`… ;
- graphiques affichés dans la console (appui long pour enregistrer l’image) ;
- paquets installés à la demande : un `library(forecast)` ou `tseries::adf.test` télécharge le paquet
  depuis le dépôt webR ; `install.packages()` fonctionne aussi ;
- les fichiers de `donnees/` sont copiés dans le répertoire de travail : `scan("donnees/serie1.dat")` ;
  menu ⋯ → importer un fichier du téléphone, exemples, enregistrer le script, redémarrer R ;
- sur chaque bloc de code des chapitres, le bouton **▶ R** ouvre la console et exécute le code.

Le premier lancement télécharge R (~25 Mo) depuis `webr.r-wasm.org` ; le service worker le garde ensuite en cache
(`atelier-runtime`), ainsi que les paquets installés.

## Données (`donnees/`)

Toutes les séries des exemples et des TP, en `.dat` (une valeur par ligne, pour `scan()`) et en `.csv` (`date,valeur`) :

- **séries réelles** : varicelle à New York 1931–1972, précipitations mensuelles 1932–1966, taux obligataires à 2 ans
  1969–1994, rendements journaliers du NYSE 1984–1991 (sources : Time Series Data Library de R. Hyndman, paquet `astsa`) ;
- **copies des séries de R** : USAccDeaths, AirPassengers, co2, sunspot.year, EuStockMarkets ;
- **séries simulées des TP** : `simulation`, `serie1`, `serie2` (solutions dans `donnees/SOLUTIONS_SIMULATIONS.md`).

Détail des sources et des substituts dans [`donnees/README.md`](donnees/README.md). Tout se régénère avec
`Rscript donnees/generer_donnees.R`, qui écrit aussi `js/cours/data-tp.js` pour l’application. Les deux pages utilisent
ces séries : la page du cours dans ses TP, l’Atelier dans tous ses chapitres et dans le laboratoire.

## Moteur numérique (`js/stats.js`)

- ACF/PACF (Durbin-Levinson), bandes de Bartlett, Ljung-Box, Jarque-Bera, périodogramme
- ADF avec sélection des retards par AIC, p-valeurs de MacKinnon (1994) et valeurs critiques (2010) ;
  KPSS avec variance de long terme de Newey-West
- Décomposition classique, Box-Cox et λ par vraisemblance profilée, suggestions de d et D
- ARMA : simulation, ACF/PACF théoriques, racines (Durand-Kerner), poids ψ
- Lissage exponentiel (SES, Holt, amorti, Holt-Winters additif/multiplicatif) optimisé par Nelder-Mead
- SARIMA(p,d,q)(P,D,Q)s par moindres carrés conditionnels, stationnarité et inversibilité imposées par la
  reparamétrisation en autocorrélations partielles, erreurs-types par hessien numérique, prévision et
  intervalles par poids ψ, recherche automatique par AICc

Validation (`tests/stats.test.js`) : l’ADF sur log(AirPassengers) reproduit la référence statsmodels / urca
(stat −1,717, p 0,422, 13 retards) ; le modèle airline retrouve les coefficients de R à l’écart
CSS/ML près ; les AR et MA simulés sont réestimés correctement.

```bash
node --test tests/stats.test.js
```

## Structure

```
index.html            coque de l'application
css/style.css         thème clair/sombre, mise en page mobile
js/stats.js           moteur numérique (navigateur + Node)
js/data.js            jeux de données (AirPassengers + séries simulées)
js/charts.js          graphiques SVG avec survol
js/ui.js              contrôles, quiz, blocs de code R
js/ch-*.js            chapitres (ch-cas.js : études de cas, ch-exercices.js : exercices)
js/app.js             navigation (partagée par les deux pages)
js/cours/             chapitres et données de la page Cours M2 GRAF
donnees/              fichiers .dat et .csv des exemples et des TP, script R de génération
cours-m2graf.html     page Cours M2 GRAF
console-r.html        console R (webR) : js/console-r.js, css/console-r.css
vendor/               MathJax 3.2.2 (Apache 2.0), embarqué pour fonctionner hors ligne
```
