# Polc — saját könyvtár

Telefonon és számítógépen használható, telepíthető webalkalmazás könyvek, e-könyvek és hangoskönyvek nyilvántartásához.

## Mit tud az első változat?

- Könyvek felvétele, szerkesztése és törlése
- Formátum, olvasási állapot, saját lista, műfaj, ISBN, kiadó, kiadási év, oldalszám és borító rögzítése
- Egyéni könyvlisták létrehozása, átnevezése és törlése; induláskor az „El szeretném olvasni” lista jelenik meg
- ISBN-13 beolvasása a telefon kamerájával olyan biztonságos böngészőben, amely támogatja a vonalkód-olvasást
- ISBN alapján adatkeresés a Google Booksban, majd hiányos találat esetén az Open Libraryben
- Keresés, szűrés és könyvtári összesítő
- Helyi használat internet nélkül, az adatok az adott böngészőben maradnak
- JSON-mentés a könyvtár biztonsági másolatához
- Opcionális közös online adatbázis, hogy több eszköz ugyanazt a könyvtárat használja
- Telepíthető PWA, amely HTTPS-en kiszolgálva offline is megnyitja az alkalmazás felületét

## Helyi kipróbálás

Nyisd meg az `index.html` fájlt egy korszerű böngészőben. A helyi könyvlista az adott eszköz böngészőjében tárolódik. Ez a mód önmagában nem szinkronizál más eszközökkel.

## Közös adatbázis beállítása

Az eszközök közötti megosztáshoz egy Supabase projekt szükséges.

1. Hozz létre egy Supabase projektet.
2. A projekt SQL Editorában futtasd le a `supabase/schema.sql` teljes tartalmát. Ha már korábban beállítottad a Polc adatbázisát, ezt az új változatot is futtasd le: hozzáadja a saját listák és a könyv-adatmezők tábláit/oszlopait, a meglévő könyveket nem törli.
3. Másold ki a projekt URL-jét és a publikus `anon` vagy `publishable` kulcsát a projekt API-beállításaiból.
4. Tedd közzé ezt a mappát egy HTTPS-t támogató statikus webtárhelyen. A telefonos telepítéshez HTTPS szükséges. Androidon a böngésző telepítési gombot kínálhat; iPhone-on nyisd meg Safariban, koppints a Megosztás gombra, majd válaszd a Hozzáadás a főképernyőhöz lehetőséget.
5. Nyisd meg az alkalmazást, válaszd a beállításokat, add meg az URL-t és a publikus kulcsot, majd mentsd el.
6. Hozz létre fiókot, vagy jelentkezz be. Ha e-mailes megerősítést kér a projekt, először erősítsd meg a fiókot a levelezésedből.
7. A számítógépen és a telefonon is ugyanezt az alkalmazást és ugyanazt a fiókot használd. A könyvek a közös adatbázisból töltődnek be.

Az alkalmazás csak a böngészőben használható publikus kulcsot kéri; **Supabase service role / secret kulcsot soha ne tegyél a böngészőbe**. A táblán bekapcsolt sor szintű jogosultság (RLS) miatt minden fiók csak a saját könyveit olvashatja és módosíthatja.

## ISBN és automatikus könyvadatok

Az ISBN keresés internetkapcsolatot igényel. Az alkalmazás először a Google Books katalógusát, majd hiányzó adat esetén az Open Libraryt kérdezi le. A cím, szerző, kiadó, év, oldalszám és borító adatainak teljessége könyvenként eltérhet; mentés előtt ellenőrizd az eredményt. Az ISBN-kódot a két nyilvános katalógushoz küldi el az alkalmazás. A kamerás vonalkód-beolvasáshoz HTTPS, kameraengedély és támogatott böngésző szükséges; más esetben az ISBN kézzel is beírható.

## Fontos a helyi és a felhős könyvtárakról

A helyi könyvek nem töltődnek fel automatikusan a felhőbe. Ha bejelentkezéskor a közös könyvtár még üres, az alkalmazás megkérdezi, feltöltse-e a helyi könyveket. A helyi lista a kijelentkezés után is elérhető marad azon az eszközön, és a **Könyvtár mentése fájlba** gombbal JSON-másolat készíthető róla.

## Fájlok

- `index.html`, `styles.css`, `app.js`: alkalmazás
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`: telepíthető PWA és offline alkalmazásváz
- `supabase/schema.sql`: adatbázistábla és hozzáférési szabályok

