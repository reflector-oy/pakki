# Pakki

Kokoelma pieniä selaintyökaluja. Kaikki koodi ajetaan käyttäjän omalla koneella — ei API-kutsuja ulkoisiin palveluihin, ei tietojen lähetystä minnekään.

**→ [reflector-oy.github.io/pakki](https://reflector-oy.github.io/pakki/)**

---

## Työkalut

### Gantt-muunnin (`gantt/`)

Lataa CSV-tiedosto ja visualisoi projektin aikataulu interaktiivisena Gantt-kaaviona.

| Sarake | Kuvaus | Arvot |
|---|---|---|
| `Nimi` * | Tehtävän nimi | Vapaateksti |
| `Alkupaiva` * | Alkupäivämäärä | 2026-01-15 tai 15.1.2026 |
| `Loppupaiva` * | Loppupäivämäärä | 2026-04-30 |
| `Suuruusluokka` | Työn koko | S · M · L · XL |
| `Tikettinumero` | Viitetunnus | INT-1042 |
| `Edistyminen` | Valmistumisaste | 0–100 |

Sarakkeiden nimet voivat olla myös englanniksi (`name`, `start`, `end`, `size`, `ticket`, `progress`).

Esimerkkitiedosto: [`gantt/pakki_esimerkki.csv`](gantt/pakki_esimerkki.csv)

---

### GitGraph-muunnin (`gitgraph/`)

Muunna release-aikataulu CSV:stä GitGraph-diagrammiksi. Visualisoi haarautuminen, julkaisut ja hotfixit Mermaid-kirjaston avulla.

| Sarake | Kuvaus | Arvot |
|---|---|---|
| `Tyyppi` * | Toiminnon tyyppi | `commit` · `haara` · `yhdista` |
| `Haara` * | Kohdehaarma | `main` · `release/1.0` jne. |
| `Kuvaus` | Commitin teksti | Vapaateksti |
| `Versio` | Release-tagi | v1.0.0 |
| `Paiva` | Päivämäärä (näyttötarkoitus) | 2026-03-01 |

Esimerkkitiedosto: [`gitgraph/pakki_esimerkki.csv`](gitgraph/pakki_esimerkki.csv)

---

### Riskimatriisi (`riskimatriisi/`)

Lataa riskirekisteri CSV-tiedostona ja visualisoi riskit 5×5-matriisina todennäköisyyden ja vaikutuksen mukaan.

| Sarake | Kuvaus | Arvot |
|---|---|---|
| `Riski` * | Riskin kuvaus | Vapaateksti |
| `Todennäköisyys` * | Toteutumisen todennäköisyys | 1 (harvinainen) – 5 (lähes varma) |
| `Vaikutus` * | Toteutumisen vaikutus | 1 (vähäinen) – 5 (katastrofaalinen) |
| `Omistaja` | Vastuuhenkilö | Vapaateksti |
| `Toimenpide` | Hallintakeino | Vapaateksti |

Sarakkeiden nimet voivat olla myös englanniksi (`risk`, `probability`, `impact`, `owner`, `action`).

Esimerkkitiedosto: [`riskimatriisi/pakki_esimerkki.csv`](riskimatriisi/pakki_esimerkki.csv)

---

### Markdown muotoilija (`markdownpreview/`)

Lataa (drag and drop) markdown tiedoston ja näyttää sen muotoiltuna.  
Raahaa markdown (*.md) tiedosto hiirellä selaimen ruutuun. Uuden tiedoston voi raahata edellisen päälle.

---

## Rakenne

```
pakki/
├── index.html              # Etusivu / työkalu-lista
├── lib/
│   └── mermaid.min.js      # Mermaid v11 (paikallinen, ei CDN-kutsuja)
├── gantt/
│   ├── index.html
│   └── pakki_esimerkki.csv
├── gitgraph/
│   ├── index.html
│   └── pakki_esimerkki.csv
├── markdownpreview/
│   ├── index.html
│   ├── scripts.js
│   └── styles.css
└── riskimatriisi/
    ├── index.html
    └── pakki_esimerkki.csv
```

## Uuden työkalun lisääminen

1. Luo uusi hakemisto ja sen sisään `index.html`
2. Lisää kortti `index.html`:n `tool-grid`-diviin (kopioi olemassa oleva `<a class="tool-card">` -lohko malliksi)
3. Kaikki logiikka tulee olla asiakaspuolen JavaScriptia — ei ulkoisia API-kutsuja ajonaikana

---

## GitHub Pages -käyttöönotto

1. Mene repon **Settings → Pages**
2. Valitse lähteeksi `main`-haara, hakemisto `/ (root)`
3. Tallenna — sivu julkaistaan muutamassa minuutissa osoitteeseen `https://reflector-oy.github.io/pakki/`
