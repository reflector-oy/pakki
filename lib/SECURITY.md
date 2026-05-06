# lib/ — tietoturvatarkistus

**Viimeksi tarkistettu:** 2026-05-06

Tarkistuksen kohde: onko kirjastoissa ajonaikaisia kutsuja ulkoisiin rajapintoihin (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`).

---

## Tulokset

| Kirjasto | Koko | fetch() | XHR | WebSocket | Tulos |
|---|---|---|---|---|---|
| `html-docx.js` | 406 KB | 0 | 0 | 0 | ✅ Puhdas |
| `jszip.min.js` | 95 KB | 0 | 0 | 0 | ✅ Puhdas |
| `marked.umd.js` | 42 KB | 0 | 0 | 0 | ✅ Puhdas |
| `markdown.js` | 2.5 KB | 0 | 0 | 0 | ✅ Puhdas |
| `mermaid.min.js` | 3.0 MB | 3* | 0 | 0 | ✅ Puhdas |

*\* `mermaid.min.js`:n `fetch()`-osumat ovat KaTeX-matemaattisen renderöintikirjaston tokenizerin metodinimiä (`this.fetch()`, `t.fetch().text`) — ei selaimen `window.fetch`. Ei verkkoyhteyksiä.*

## Huomiot

- **html-docx.js**: URL-osoitteet tiedostossa ovat OpenXML-standardin XML-nimiavaruusmääritelmiä ja kommenttien dokumentaatiolinkkejä — eivät ajonaikaisia kutsuja.
- **jszip.min.js**: URL:t ovat lisenssitekstiä ja dokumentaatiolinkkejä kommenteissa.
- **marked.umd.js**: Ainoa URL on viittaus GitHub-repositorioon kommentissa.
- **mermaid.min.js**: Sisältää KaTeX-kirjaston, jonka parseri käyttää `fetch()`-nimeä sisäisenä metodina ilman yhteyttä selain-APIin.

## Johtopäätös

Kaikki kirjastot ovat turvallisia käytettäväksi offline-/selainympäristössä. Yksikään ei tee HTTP-pyyntöjä ajon aikana — kaikki toiminta tapahtuu paikallisesti käyttäjän koneella.
