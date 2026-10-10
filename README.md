# planner-telaio

Pianificatore per il telaio in profilato di alluminio con mensole in plexiglass:
deve stare nel registro del ripiano della cassa SKB e uscire intero verso la borsa Samas.

Il dispositivo Film Devices Versa e' solo un riferimento di layout: qui si progetta un
portakit su misura.

## Anteprima sul web

Poi che Pagine e' attiva (Settings → Pages → Branch: `main`, cartella radice):

- pianificatore: <https://edoardotedone.github.io/planner-telaio/>

Nessuna build, nessun framework: sono file statici.

## Apirlo in locale

Doppio clic su `serve.bat` (serve Python installato) → `http://127.0.0.1:8123/`.

Non funziona con doppio clic su `index.html`: i moduli ES richiedono `http://`.

## File

| Percorso | Cosa e' |
|---|---|
| `index.html`, `app.js`, `model.js`, `scene.js`, `styles.css` | l'app. L'unica dipendenza e` `lib/` (`three.module.min.js` importa `three.core.js`: servono tutti e due) |
| `model.js` | i numeri di partenza: moduli, misure provvisorie (A9-A14, B1-B4), livelli, scelte di progetto |
| `fonts/` | i tre caratteri usati (OFL, licenza libera) |
| `forms/questions-for-brother-a4.html` | il foglio A4 da stampare e compilare |
| `forms/questions-for-brother.it.md` | lo stesso elenco in markdown, da leggere a schermo |
| `info/` | le foto di cassa, cassetto e borsa |
| `serve.py` / `serve.bat` | server locale con `Cache-Control: no-store` |

## Stato

Prototipo: la struttura e' giusta, i numeri dentro `model.js` sono provvisori perche' il
foglio domande non e' ancora compilato. Le etichette `PROVVISORIO` / `SCHEDA` / `CALCOLATO`
dentro "Kit in elenco" dicono quali misure sono inventate e quali vengono da una scheda tecnica.

Le note di progetto e gli script che hanno generato il foglio A4 stanno nella copia di
lavoro privata, non in questo deposito.
