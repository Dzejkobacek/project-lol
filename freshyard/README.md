# Freshyard.cz – 3D redesign

Statický web (bez build kroku): `index.html`, `galerie.html`, `assets/`, `api/contact.php`.

- **3D hero**: Three.js (r170, přiložen v `assets/js/vendor/`) – keř se při scrollu „zastřihne“ do kostky, ustřižené listy padají, kurzor funguje jako vítr.
- **Smooth scroll**: Lenis (přiložen v `assets/js/vendor/`).
- Fotky a videa se načítají přímo z `https://www.freshyard.cz/assets/...` (stejné cesty). Při nasazení na doménu freshyard.cz stačí nechat, nebo nahradit `https://www.freshyard.cz/` za `/` v HTML, CSS a v `ASSET_BASE` v `assets/js/main.js`.
- **Formulář** posílá POST na `api/contact.php` (PHP `mail()` na info@freshyard.cz, honeypoty `website` / `company`).
- **Google Analytics** se spustí až po souhlasu. Měřicí ID doplňte jako `<html data-ga-id="G-XXXXXXX">`.
- `prefers-reduced-motion` vypíná 3D, částice, smooth scroll i animace; slabá zařízení dostanou statický obrázek.

Lokální spuštění: `php -S 127.0.0.1:8000 -t freshyard` a otevřít http://127.0.0.1:8000/
