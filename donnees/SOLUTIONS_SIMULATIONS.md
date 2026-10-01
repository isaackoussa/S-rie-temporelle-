# Solutions des séries simulées

À lire **après** avoir cherché : les TP demandent justement de retrouver ces processus.
Les séries sont produites par `generer_donnees.R` avec `set.seed(2022)`.

## `simulation.dat` (TP 3, 6.2)

\[ X_t = 0{,}3\,t + 4\cos\Big(\frac{t\pi}{6}\Big) + 1{,}5\,\epsilon_t,\qquad \epsilon_t \sim \mathcal N(0,1),\quad t = 1,\dots,180 \]

Tendance linéaire de pente 0,3, composante périodique de période 12 (b = 6 dans l’indication du TP), amplitude 4.

## `serie1.dat` (TP 4, 9.2)

ARIMA(1, 1, 0) : \( \Delta X_t = 0{,}7\,\Delta X_{t-1} + \epsilon_t \), puis décalée de 50. Après une différence, la PACF coupe après le retard 1.

## `serie2.dat` (TP 4, 9.2)

ARIMA(0, 1, 2) : \( \Delta X_t = \epsilon_t + 0{,}6\,\epsilon_{t-1} + 0{,}4\,\epsilon_{t-2} \), puis décalée de 20. Après une différence, l’ACF coupe après le retard 2.
