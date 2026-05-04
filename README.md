# Pakki

Kokoelma pieniä selaintyökaluja. Kaikki koodi ajetaan käyttäjän omalla koneella — ei API-kutsuja ulkoisiin palveluihin, ei tietojen lähetystä minnekään.

**→ [reflector-oy.github.io/pakki](https://reflector-oy.github.io/pakki/)**

---

## Työkalut

### 📊 Gantt-muunnin (`gantt.html`)

Lataa CSV-tiedosto ja visualisoi projektin aikataulu interaktiivisena Gantt-kaaviona.

**CSV-sarakkeet:**

| Sarake | Kuvaus | Esimerkki |
|---|---|---|
| `Nimi` * | Tehtävän nimi | SAP - CRM integraatio |
| `Alkupaiva` * | Alkupäivämäärä | 2026-01-15 tai 15.1.2026 |
| `Loppupaiva` * | Loppupäivämäärä | 2026-04-30 |
| `Suuruusluokka` | Työn koko | S · M · L · XL |
| `Tikettinumero` | Viitetunnus | INT-1042 |
| `Edistyminen` | Valmistumisaste 0–100 | 75 |

`*` pakollinen sarake. Sarakkeiden nimet voivat olla myös englanniksi (`name`, `start`, `end`, `size`, `ticket`, `progress`).

Esimerkkitiedosto: [`integraatioiden_aikataulu.csv`](integraatioiden_aikataulu.csv)

**Ominaisuudet:**
- Automaattinen aikaskaala (viikot / kuukaudet / kvartaalit) datan laajuuden mukaan
- Edistymispalkit ja suuruusluokkavärjäys
- Tooltip tehtävän tiedoilla
- Tulosta tai vie PNG-kuvana

---

## Uuden työkalun lisääminen

1. Luo uusi `.html`-tiedosto repojuureen
2. Lisää kortti `index.html`:n `tool-grid`-diviin (kopioi olemassa oleva `<a class="tool-card">` -lohko malliksi)
3. Kaikki logiikka tulee olla asiakaspuolen JavaScriptia — ei ulkoisia API-kutsuja

---

## GitHub Pages -käyttöönotto

1. Mene repon **Settings → Pages**
2. Valitse lähteeksi `main`-haara, hakemisto `/ (root)`
3. Tallenna — sivu julkaistaan muutamassa minuutissa osoitteeseen `https://reflector-oy.github.io/pakki/`
