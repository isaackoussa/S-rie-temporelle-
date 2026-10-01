# =============================================================================
# generer_donnees.R — construit tous les fichiers du dossier donnees/
#
#   Rscript donnees/generer_donnees.R        (depuis la racine du dépôt)
#
# 1. Séries réelles téléchargées depuis leurs sources publiques :
#    - Time Series Data Library de R. Hyndman (paquet tsdl, github.com/FinYang/tsdl)
#    - paquet astsa de Shumway & Stoffer (référence [6] du cours), miroir CRAN sur GitHub
# 2. Séries fournies avec R (datasets) exportées en .dat et .csv
# 3. Séries simulées des TP (simulation.dat, serie1.dat, serie2.dat), graine fixée
#
# Formats : .dat = une valeur par ligne, lisible par scan() comme dans le cours ;
#           .csv = colonnes date,valeur, importable dans le laboratoire de l'Atelier.
# =============================================================================

dir <- if (dir.exists("donnees")) "donnees" else "."

ecrire <- function(x, nom, dates) {
  write(format(as.numeric(x), digits = 10, trim = TRUE, scientific = FALSE, drop0trailing = TRUE), file.path(dir, paste0(nom, ".dat")), ncolumns = 1)
  write.csv(data.frame(date = dates, valeur = as.numeric(x)), file.path(dir, paste0(nom, ".csv")), row.names = FALSE, quote = FALSE)
  cat(sprintf("%-26s n = %4d   %s -> %s\n", nom, length(x), dates[1], dates[length(dates)]))
}
mois <- function(x) sprintf("%d-%02d", floor(time(x) + 1e-6), cycle(x))
annees <- function(x) as.character(floor(time(x) + 1e-6))

# --------------------------------------------------------------------- 1. Séries réelles
tmp <- tempfile(fileext = ".rda")
download.file("https://raw.githubusercontent.com/FinYang/tsdl/master/data/tsdl.rda", tmp, mode = "wb", quiet = TRUE)
load(tmp)
desc <- sapply(tsdl, function(x) paste(unlist(attr(x, "description")), collapse = " "))
trouver <- function(motif) { i <- grep(motif, desc); stopifnot(length(i) == 1); tsdl[[i]] }

# TP 1 : varicelle, New York, janvier 1931 - juin 1972 (Hipel & McLeod, 1994)
varicelle <- trouver("^Monthly reported number of chickenpox, New York city")
ecrire(varicelle, "varicelle", mois(varicelle))

# TP 4 (9.4) : précipitations mensuelles 1932-1966, même période que sanfran.dat
# (Hipel & McLeod, 1994 : « Southwestern mountain region ») — substitut de sanfran.dat
precip <- trouver("^Monthly precipitation \\(mm\\), Southwestern mountain region")
ecrire(precip, "precipitations", mois(precip))

# TP 4 (9.5) : taux obligataires australiens à 2 ans, 1969-1994 — substitut de UKinterestrates.dat
taux <- trouver("^Monthly interest rates Government Bond Yield 2-year securities")
ecrire(taux, "taux_interet", mois(taux))

# TP 5 (11.3) et figure 26 : rendements journaliers de la bourse de New York (NYSE),
# 2 février 1984 - 31 décembre 1991 (Shumway & Stoffer, paquet astsa)
tmp2 <- tempfile(fileext = ".rda")
download.file("https://raw.githubusercontent.com/cran/astsa/master/data/nyse.rda", tmp2, mode = "wb", quiet = TRUE)
load(tmp2)
ecrire(nyse, "nyse", as.character(seq_along(nyse)))

# --------------------------------------------------------------------- 2. Séries fournies avec R
ecrire(USAccDeaths, "usaccdeaths", mois(USAccDeaths))
ecrire(AirPassengers, "airpassengers", mois(AirPassengers))
ecrire(co2, "co2", mois(co2))
ecrire(sunspot.year, "sunspot_year", annees(sunspot.year))
for (j in colnames(EuStockMarkets)) {
  x <- EuStockMarkets[, j]
  ecrire(x, paste0("eustock_", tolower(j)), format(round(as.numeric(time(x)), 4), nsmall = 4))
}

# --------------------------------------------------------------------- 3. Séries simulées des TP
# Les processus générateurs sont décrits dans SOLUTIONS_SIMULATIONS.md (à lire après avoir cherché).
set.seed(2022)
t <- 1:180
simulation <- 0.3 * t + 4 * cos(t * pi / 6) + rnorm(180, sd = 1.5)                       # TP 3 (6.2)
ecrire(round(simulation, 4), "simulation", as.character(t))

serie1 <- arima.sim(model = list(order = c(1, 1, 0), ar = 0.7), n = 299)                 # TP 4 (9.2)
ecrire(round(serie1 + 50, 4), "serie1", as.character(seq_along(serie1)))

serie2 <- arima.sim(model = list(order = c(0, 1, 2), ma = c(0.6, 0.4)), n = 299)         # TP 4 (9.2)
ecrire(round(serie2 + 20, 4), "serie2", as.character(seq_along(serie2)))

# --------------------------------------------------------------------- 4. Copie pour l'application web
js_out <- file.path(dir, "..", "js", "cours", "data-tp.js")
if (dir.exists(dirname(js_out))) {
  v <- function(x) paste0("[", paste(format(as.numeric(x), digits = 10, trim = TRUE, scientific = FALSE, drop0trailing = TRUE), collapse = ","), "]")
  m <- function(x) sprintf("{start:[%d,%d],frequency:%d,values:%s}", as.integer(start(x)[1]), as.integer(start(x)[2]), as.integer(frequency(x)), v(x))
  writeLines(c(
    "/* Généré par donnees/generer_donnees.R : fichiers des TP (voir donnees/README.md pour les sources). */",
    "(function (root) {",
    "  root.CoursTP = {",
    paste0("    varicelle: ", m(varicelle), ","),
    paste0("    precipitations: ", m(precip), ","),
    paste0("    taux: ", m(taux), ","),
    paste0("    nyse: ", v(nyse), ","),
    paste0("    simulation: ", v(round(simulation, 4)), ","),
    paste0("    serie1: ", v(round(serie1 + 50, 4)), ","),
    paste0("    serie2: ", v(round(serie2 + 20, 4)), ","),
    "  };",
    "})(typeof window !== \"undefined\" ? window : globalThis);"), js_out)
  cat("Copie pour l'application :", normalizePath(js_out), "\n")
}

cat("Fichiers écrits dans", normalizePath(dir), "\n")
