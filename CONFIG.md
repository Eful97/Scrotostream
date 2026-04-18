# Configurazione ScrotoStream

## Variabili d'ambiente

| Variabile | Descrizione | Default |
|----------|------------|---------|
| `CF_PROXY_URL` | Cloudflare Worker proxy per SuperVideo | - |
| `DISABLE_MIXDROP` | Disabilita MixDrop | false |
| `ADDON_CACHE_ENABLED` | Abilita caching | true |

## Backend URL

Alcuni provider usano un backend per risolvere gli stream. L'URL di default punta a:

```
https://easystreams.realbestia.com/resolve/guardoserie
```

Per usare un backend personalizzato, modifica i file provider:

- `providers/guardoserie.js`
- `providers/guardoserie_ec.js`  
- `providers/index.js`
- `src/guardoserie/index.js`

## Note

- Il backend originale è mantenuto da realbestia1
- Se il backend non funziona, puoi hostare il tuo server
- Consulta la documentazione di easystreams per il server di resolve