# Guida Migrazione ScrotoStream

Se stavi usando easystreams (realbestia1), ecco come migrare a ScrotoStream.

## Per utenti Nuvio

1. Rimuovi il plugin easystreams esistente
2. Installa il nuovo plugin:
   ```
   https://raw.githubusercontent.com/Eful97/Provaeasy/master/
   ```
3. Vedrai il nome **ScrotoStream** invece di EasyStreams

## Per utenti Stremio

Aggiorna l'URL dell'addon da:
```
https://easystreams.realbestia.com/
```
a:
```
https://raw.githubusercontent.com/Eful97/Provaeasy/master/stremio_addon.js
```

Oppure esegui in locale:
```bash
cd ScrotoStream
npm install
npm start
```

## Cambiamenti

| Prima | Dopo |
|-------|------|
| EasyStreams | ScrotoStream |
| org.bestia.easystreams | org.scrotostream |
| 📡 Provider | ⚙️ Provider |
| 🚀 FHD | 👌 FHD |
| 💿 HD | ⚡ HD |

## Note

- I provider sono gli stessi (Guardoserie, GuardaHD, AnimeUnity, ecc.)
- La funzionalità è identica
- Solo renaming e emoji personalizzate