# Atelier Séries Temporelles

Application web pédagogique sur les séries temporelles, de l’explication à la pratique : théorie formalisée,
simulations interactives, et un laboratoire qui analyse vos propres données jusqu’à la prévision.

Tout est calculé dans le navigateur par un moteur numérique écrit pour l’occasion (`js/stats.js`, sans
dépendance). Chaque chapitre se termine par le code Python équivalent (statsmodels) et un quiz.

## Lancer

Aucune installation. Servez le dossier avec n’importe quel serveur statique :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ouvrir `index.html` directement (file://) fonctionne aussi. Le site peut être publié tel quel sur GitHub Pages.

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
| 8 | Labo : vos données | pipeline complet | import CSV, choix automatique, prévision exportable, script Python |
| 9 | Études de cas | 4 analyses complètes commentées étape par étape : AirPassengers (Box-Jenkins), ventes additives à vérité connue, charge électrique journalière, marche aléatoire et régression fallacieuse | chiffres recalculés en direct, code Python par étape |
| 10 | Exercices appliqués | identification ARMA, diagnostic de stationnarité, calculs à la main, défi de prévision sur données cachées | énoncés aléatoires, corrections détaillées, score |

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

Validation (`tests/stats.test.js`) : l’ADF sur log(AirPassengers) reproduit statsmodels
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
js/ui.js              contrôles, quiz, blocs de code
js/ch-*.js            chapitres (ch-cas.js : études de cas, ch-exercices.js : exercices)
js/app.js             navigation
vendor/               MathJax 3.2.2 (Apache 2.0), embarqué pour fonctionner hors ligne
```
