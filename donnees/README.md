# Données des exemples et des TP

Tous les fichiers existent en deux formats :

- **`.dat`** : une valeur par ligne, à lire comme dans le cours avec `scan()` ;
- **`.csv`** : colonnes `date,valeur`, importables dans le laboratoire de l’Atelier (chapitre « Labo : vos données »).

Pour tout régénérer depuis les sources : `Rscript donnees/generer_donnees.R` (depuis la racine du dépôt).

## Fichiers des TP du cours M2 GRAF

| Fichier | Utilisé dans | Contenu | Source |
|---|---|---|---|
| `varicelle` | TP 1 (2.1) | cas mensuels de varicelle à New York, janvier 1931 – juin 1972 (498 mois) | Hipel & McLeod (1994), via la Time Series Data Library (R. Hyndman) |
| `simulation` | TP 3 (6.2) | série simulée « à deviner » (180 valeurs) | simulée, voir `SOLUTIONS_SIMULATIONS.md` |
| `serie1`, `serie2` | TP 4 (9.2) | séries à identifier (300 valeurs chacune) | simulées, voir `SOLUTIONS_SIMULATIONS.md` |
| `precipitations` | TP 4 (9.4) | précipitations mensuelles (mm), janvier 1932 – décembre 1966 (420 mois) | Hipel & McLeod (1994), via la Time Series Data Library |
| `taux_interet` | TP 4 (9.5) | taux des obligations d’État australiennes à 2 ans, janvier 1969 – septembre 1994 (309 mois) | Reserve Bank of Australia, via la Time Series Data Library |
| `nyse` | §10 (figure 26), TP 5 (11.3) | rendements journaliers de la bourse de New York, 2 février 1984 – 31 décembre 1991 (2 000 jours) | Shumway & Stoffer, paquet R `astsa` (référence [6] du cours) |

**Substituts signalés.**
- `precipitations` couvre exactement la période de `sanfran.dat` (1932–1966) ; la source la décrit comme
  « Southwestern mountain region » des États-Unis, et non San Francisco.
- `taux_interet` remplace `UKinterestrates.dat` (spread des taux britanniques 1953–1995), introuvable dans les sources
  publiques accessibles : c’est une vraie série de taux d’intérêt, adaptée à la même démarche ARMA / ARIMA.

Si vous disposez des fichiers originaux distribués en TP, utilisez-les à la place : le code des corrigés s’applique tel quel.

## Séries fournies avec R (copies pour travailler hors de R)

| Fichier | Équivalent R | Contenu |
|---|---|---|
| `usaccdeaths` | `USAccDeaths` | morts accidentelles aux États-Unis, 1973–1978 (mensuel) |
| `airpassengers` | `AirPassengers` | passagers aériens internationaux (milliers), 1949–1960 (mensuel) |
| `co2` | `co2` | CO₂ à Mauna Loa (ppm), 1959–1997 (mensuel) |
| `sunspot_year` | `sunspot.year` | taches solaires annuelles, 1700–1988 |
| `eustock_dax`, `_smi`, `_cac`, `_ftse` | `EuStockMarkets` | clôtures journalières des 4 indices européens, 1991–1998 (la colonne `date` est le temps décimal de R) |

## Exemples de lecture sous R

```r
varicelle <- ts(scan("donnees/varicelle.dat"), start = c(1931, 1), frequency = 12)
precip    <- ts(scan("donnees/precipitations.dat"), start = c(1932, 1), frequency = 12)
taux      <- ts(scan("donnees/taux_interet.dat"), start = c(1969, 1), frequency = 12)
nyse      <- scan("donnees/nyse.dat")
s         <- scan("donnees/simulation.dat")
serie1    <- scan("donnees/serie1.dat")
```
