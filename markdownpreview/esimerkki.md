# Projektisuunnitelma: Asiakasportaalin uudistus

## Tausta

Asiakasportaali on ollut käytössä vuodesta 2019. Tekninen velka ja käyttäjäpalaute edellyttävät kokonaisuudistusta. Uudistuksen tavoitteena on parantaa käytettävyyttä, nopeuttaa sivulatausta ja mahdollistaa mobiiliyhteensopivuus.

## Tavoitteet

- Uusi responsiivinen käyttöliittymä
- Kirjautumisajan lyhentäminen alle 2 sekuntiin
- Integraatio uuteen CRM-järjestelmään
- WCAG 2.1 AA -saavutettavuusvaatimukset

## Aikataulu

| Vaihe | Kesto | Vastuuhenkilö |
|---|---|---|
| Vaatimusmäärittely | 3 vk | Liiketoiminta-analyytikko |
| UX-suunnittelu | 4 vk | UX-designer |
| Tekninen toteutus | 10 vk | Kehitystiimi |
| Testaus ja käyttöönotto | 3 vk | Testausvastaava |

## Riskit

1. **Integraatioviiveet** — CRM-toimittajan API voi viivästyä
2. **Resurssipula** — kehitystiimi on osittain sitoutunut muihin projekteihin
3. **Vaatimusten muutos** — liiketoimintavaatimukset voivat tarkentua

## Tekniset valinnat

Järjestelmä rakennetaan seuraavilla teknologioilla:

```
Frontend:  React 18 + TypeScript
Backend:   Node.js + Express
Tietokanta: PostgreSQL 15
Hosting:   Azure App Service
```

## Hyväksyntäkriteerit

> Projekti katsotaan onnistuneeksi kun portaali on tuotannossa, kaikki integraatiot toimivat ja käyttäjätyytyväisyyskyselyn tulos ylittää 4/5.

---

*Dokumentti päivitetty 2026-05-06. Seuraava katselmus 2026-05-20.*
