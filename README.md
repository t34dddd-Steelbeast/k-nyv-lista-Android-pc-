# Polc — saját könyvtár

Telefonon és számítógépen használható, telepíthető webalkalmazás könyvek, e-könyvek és hangoskönyvek nyilvántartásához.

## Mit tud az első változat?

- Könyvek felvétele, szerkesztése és törlése
- Formátum, olvasási állapot, saját lista, műfaj, ISBN, kiadó, kiadási év, oldalszám és borító rögzítése
- Egyéni könyvlisták létrehozása, átnevezése és törlése; induláskor az „El szeretném olvasni” lista jelenik meg
- ISBN-13 beolvasása a telefon kamerájával olyan biztonságos böngészőben, amely támogatja a vonalkód-olvasást
- ISBN alapján adatkeresés a Google Booksban, majd hiányos találat esetén az Open Libraryben
- Könyv keresése cím és szerző alapján, majd a találatok közül kiadás kiválasztása
- Keresés, szűrés és könyvtári összesítő
- Helyi használat internet nélkül, az adatok az adott böngészőben maradnak
- JSON-mentés a könyvtár biztonsági másolatához
- Opcionális közös online adatbázis, hogy több eszköz ugyanazt a könyvtárat használja
- Telepíthető PWA, amely HTTPS-en kiszolgálva offline is megnyitja az alkalmazás felületét

## Helyi kipróbálás

Nyisd meg az `index.html` fájlt egy korszerű böngészőben. A helyi könyvlista az adott eszköz böngészőjében tárolódik. Ez a mód önmagában nem szinkronizál más eszközökkel.

## Közös adatbázis beállítása

Az eszközök közötti megosztáshoz egy Supabase projekt szükséges.

1. A Polc már előre a közös Supabase projekthez van kapcsolva; az URL-t és a böngészős alkalmazásokhoz való publikus kulcsot nem kell eszközönként megadni.
2. A Supabase projekt SQL Editorában futtasd le a `supabase/schema.sql` teljes tartalmát. Ez létrehozza a könyvek és saját listák tábláit, valamint a hozzáférési szabályokat.
3. Tedd közzé ezt a mappát egy HTTPS-t támogató statikus webtárhelyen. A telefonos telepítéshez HTTPS szükséges. Androidon a böngésző telepítési gombot kínálhat; iPhone-on nyisd meg Safariban, koppints a Megosztás gombra, majd válaszd a Hozzáadás a főképernyőhöz lehetőséget.
4. Az egyik eszközön hozz létre Polc-fiókot. Ha e-mailes megerősítést kér a projekt, először erősítsd meg a fiókot a levelezésedből.
5. A többi eszközön ugyanazzal a Polc-fiókkal jelentkezz be. Ezután a könyvek és saját listák ugyanabból a közös adatbázisból töltődnek be.

Az alkalmazás csak a böngészőben használható publikus kulcsot kéri; **Supabase service role / secret kulcsot soha ne tegyél a böngészőbe**. A táblán bekapcsolt sor szintű jogosultság (RLS) miatt minden fiók csak a saját könyveit olvashatja és módosíthatja. Első bejelentkezéskor a Polc felajánlja, hogy az adott eszközön lévő, még hiányzó könyveket hozzáadja a közös könyvtárhoz; az azonos ISBN-ű vagy című és szerzőjű könyveket nem duplázza.

## Könyv keresése és automatikus adatok

Az ISBN- és könyv szerinti keresés internetkapcsolatot igényel. A könyvkereső egy mezőben fogad címet, szerzőt vagy a kettőt együtt. Az alkalmazás a Google Books és az Open Library katalógusában keres, és több találat esetén kiadásválasztó listát mutat. A kiválasztott rekordból a cím, szerző, ISBN, kiadó, év, oldalszám és borító kerülhet az űrlapra. Az adatok teljessége könyvenként eltérhet; mentés előtt ellenőrizd őket. A kamerás vonalkód-beolvasáshoz HTTPS, kameraengedély és támogatott böngésző szükséges; más esetben az ISBN kézzel is beírható.

## Fontos a helyi és a felhős könyvtárakról

A helyi könyvek nem töltődnek fel automatikusan a felhőbe. Ha bejelentkezéskor a közös könyvtár még üres, az alkalmazás megkérdezi, feltöltse-e a helyi könyveket. A helyi lista a kijelentkezés után is elérhető marad azon az eszközön, és a **Könyvtár mentése fájlba** gombbal JSON-másolat készíthető róla.

## Fájlok

- `index.html`, `styles.css`, `app.js`: alkalmazás
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`: telepíthető PWA és offline alkalmazásváz
- `supabase/schema.sql`: adatbázistábla és hozzáférési szabályok
