# Kombat 7 (web)

Jeu de combat 2D type Street Fighter, fait avec Phaser 3 + Vite, à partir des dessins Aseprite de `drawing/`.

## Lancer
```
npm install
npm run dev      # http://localhost:5173
```

## Contrôles
| | J1 | J2 |
|---|---|---|
| Déplacer / sauter / baisser | Q D / Z / S | ← → / ↑ / ↓ |
| Poing (A) | F | K (ou pavé num. 1) |
| Spécial (B) | G | L (ou pavé num. 2) |
| Blocage | tenir la direction opposée à l'adversaire | idem |

Manettes : croix/stick, bouton 0/2 = poing, 1/3 = spécial, 9 = start (manette 1 → J1, manette 2 → J2).
Les touches sont modifiables dans `src/config.js` (`KEYMAPS`).

## Mettre à jour les dessins
Les `.aseprite` sont convertis en PNG/JSON dans `public/assets/` par un script Python (Pillow, sans Aseprite) :
```
npm run assets
```
Pour chaque perso, les tags `Idle / Jab / Special / Jump / Fall / Landing / Walk` sont utilisés tels quels,
et la portée des coups est lue dans les pixels des frames Jab/Special. Les stats (dégâts, durées) sont dans `src/config.js`.
