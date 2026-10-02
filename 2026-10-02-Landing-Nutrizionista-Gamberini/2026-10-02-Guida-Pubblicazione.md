# Sito Dott. Nicolò Gamberini: guida alla pubblicazione

## Come funziona

```
Nicolò scrive in WordPress ──(pubblica)──► build hook ──► Netlify esegue npm run build
                                                            │  legge gli articoli dalla REST API
                                                            ▼
                                                  sito statico (dist/) online
```

- **CMS:** il WordPress attuale (`nutrizionistanicologamberini.it/wp-admin`). Nicolò continua a usarlo come oggi.
- **Sito:** HTML statico generato da `scripts/build.mjs`. Non ha dipendenze npm e richiede Node 18 o superiore.
- **URL degli articoli:** identici a quelli di WordPress (`/slug-articolo/`, archivio su `/blog-nutrizione-benessere/`). Quando il dominio passerà al nuovo sito non servono redirect e il posizionamento su Google resta invariato.
- **Sito di prova:** `noindex` attivo (meta tag, header `X-Robots-Tag` e robots.txt), così Google non lo indicizza come duplicato del sito attuale.

## Struttura

| Percorso | Contenuto |
|---|---|
| `src/partials/layout.html` | Head, menu e footer comuni |
| `src/pages/*.html` | Template di home, archivio blog e articolo |
| `src/assets/` | CSS, JS e immagini, copiati in `dist/` |
| `scripts/build.mjs` | Generatore del sito |
| `scripts/2026-10-02-Categorie-Blog.json` | Associa le categorie WordPress alle 5 aree del sito |
| `wordpress/2026-10-02-Snippet-Netlify-Rebuild.php` | Snippet che avvia il rebuild a ogni pubblicazione |
| `netlify.toml` | Configurazione di build e cache |

## 1. Mettere online il sito di prova (Netlify)

1. Fai il commit e il push di questa cartella sul repository GitHub.
2. Su [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** e scegli il repository.
3. In **Base directory** inserisci `2026-10-02-Landing-Nutrizionista-Gamberini`. Build command e publish directory vengono letti da `netlify.toml`.
4. Clicca **Deploy**.
5. Vai in **Site configuration → Change site name** e scrivi `nutrizionista-gamberini`. Il sito sarà su `https://nutrizionista-gamberini.netlify.app`, se il nome è libero.

## 2. Aggiornamento automatico alla pubblicazione

1. In Netlify vai su **Site configuration → Build & deploy → Build hooks → Add build hook** (nome: "WordPress") e copia l'URL.
2. In WordPress installa il plugin **Code Snippets** e crea un nuovo snippet con il contenuto di `wordpress/2026-10-02-Snippet-Netlify-Rebuild.php`.
3. Sostituisci `NETLIFY_BUILD_HOOK` con l'URL copiato. Scegli "Esegui ovunque", poi salva e attiva.
4. **Test:** modifica un articolo e clicca "Aggiorna". In Netlify, sotto **Deploys**, deve partire un build intitolato "WordPress: pubblicato/aggiornato …". Dopo circa 30 secondi la modifica è online.

Se WordPress non risponde durante il build, il build fallisce e resta online la versione precedente. Il sito non va mai online vuoto.

## 3. Cosa fa Nicolò per scrivere un articolo

Come oggi: **Articoli → Aggiungi nuovo**. Deve compilare:
- titolo e testo, usando i titoli H2 e H3: gli H2 diventano l'indice laterale;
- **immagine in evidenza**: diventa la copertina e l'anteprima nelle card;
- **riassunto** (facoltativo): è il testo che compare nelle card;
- **categorie**: se ne crea una nuova, il build la segnala nel log e va aggiunta in `scripts/2026-10-02-Categorie-Blog.json`, altrimenti finisce nell'area "Benessere";
- per la bibliografia basta un titolo "Bibliografia": il sito la impagina in un box separato.

**Limite:** il pulsante "Anteprima" di WordPress mostra il vecchio tema, non il nuovo design.

## 4. Anteprima in locale

```bash
npm run dev        # build + server su http://localhost:8080
```

## 5. Passaggio al dominio definitivo (quando Nicolò approva)

Oggi WordPress e il sito pubblico condividono `www.nutrizionistanicologamberini.it`. Per spostare il dominio su Netlify, WordPress deve trasferirsi su un sottodominio:

1. Spostare WordPress su `cms.nutrizionistanicologamberini.it`. Lo fa l'hosting attuale; poi va aggiornato l'URL in **Impostazioni → Generali**.
2. **Immagini:** gli articoli puntano a `www…/wp-content/uploads/…`. Va aggiunta in `_redirects` la riga `/wp-content/*  https://cms.nutrizionistanicologamberini.it/wp-content/:splat  200` (proxy), altrimenti le immagini si rompono.
3. In Netlify impostare `WP_API=https://cms.nutrizionistanicologamberini.it/wp-json/wp/v2` e `ALLOW_INDEXING=true`.
4. Aggiungere il dominio in **Domain management** e modificare i DNS dal registrar, come indicato da Netlify. L'HTTPS è automatico.
5. Mettere WordPress in `noindex` (**Impostazioni → Lettura**), così Google indicizza solo il nuovo sito.
6. Inviare `https://www.nutrizionistanicologamberini.it/sitemap.xml` in Google Search Console.

## Da verificare prima della produzione

- **Numero di telefono:** il sito attuale mostra +39 371 591 2105, ma il link "chiama" punta a +39 340 622 7882. Va chiesto a Nicolò quale sia corretto.
- Testi da approvare: i 4 step del percorso, gli esempi di patologie, i punti elenco dei servizi.
- Privacy policy e cookie policy: i link sono ancora vuoti.
- Piano Netlify: controllare i limiti attuali del piano gratuito su build e banda.
