# Polc – fejlesztési lista

## Könyv hozzáadása ISBN alapján

- [x] Mobilon a kamera beolvassa a könyv EAN-13 vonalkódját, és kinyeri belőle az ISBN-t.
- [x] Az ISBN alapján az alkalmazás automatikusan keressen könyvadatokat.
- [x] Első adatforrásként a Google Books API-t használja.
- [x] Ha ott nincs találat vagy hiányos az adat, próbálja meg az Open Library API-t.
- [x] Töltse ki automatikusan, amit megtalál: cím, szerző, kiadó, megjelenési év, oldalszám és borító.
- [x] Mentés előtt lehessen átnézni és módosítani az adatokat; a hiányzó mezők kézzel is kitölthetők legyenek.

Megjegyzés: az adatforrások nem minden könyvhöz adnak vissza minden mezőt, ezért az automatikusan talált adatokat ellenőrizhetővé kell tenni.

## Saját könyvlisták és olvasási állapotok

- [x] Lehessen saját könyvlistákat létrehozni, átnevezni és törölni.
- [x] Legyen induló „El szeretném olvasni” lista, amelyhez a könyvek hozzárendelhetők.
- [x] A saját listák a közös online könyvtárral szinkronizálódjanak.

## Könyvsorozatok

- [ ] Könyvnél lehessen megadni a sorozat nevét és a kötet sorszámát.
- [ ] A sorozathoz tartozó könyvek kapjanak jól látható jelölést, és lehessen őket együtt megjeleníteni.

