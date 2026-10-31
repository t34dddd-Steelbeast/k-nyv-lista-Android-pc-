# Polc – fejlesztési lista

## Könyv hozzáadása ISBN vagy keresés alapján

- [x] Mobilon a kamera beolvassa a könyv EAN-13 vonalkódját, és kinyeri belőle az ISBN-t.
- [x] Az ISBN alapján az alkalmazás automatikusan keressen könyvadatokat.
- [x] Első adatforrásként a Google Books API-t használja.
- [x] Ha ott nincs találat vagy hiányos az adat, próbálja meg az Open Library API-t.
- [x] Töltse ki automatikusan, amit megtalál: cím, szerző, kiadó, megjelenési év, oldalszám és borító.
- [x] Mentés előtt lehessen átnézni és módosítani az adatokat; a hiányzó mezők kézzel is kitölthetők legyenek.
- [x] ISBN nélkül, cím vagy szerző alapján is lehessen könyvre keresni.
- [x] Több találat esetén lehessen kiválasztani a pontos könyvet vagy kiadást, például fordítás, újrakiadás, e-könyv vagy nyomtatott változat szerint.
- [x] A kiválasztott találat adatai kerüljenek a mentés előtti űrlapra, ahol továbbra is ellenőrizhetők és módosíthatók.

Megjegyzés: az adatforrások nem minden könyvhöz adnak vissza minden mezőt, ezért az automatikusan talált adatokat ellenőrizhetővé kell tenni.

## Saját könyvlisták és olvasási állapotok

- [x] Lehessen saját könyvlistákat létrehozni, átnevezni és törölni.
- [x] Legyen induló „El szeretném olvasni” lista, amelyhez a könyvek hozzárendelhetők.
- [x] A saját listák a közös online könyvtárral szinkronizálódjanak.

## Kapcsolódó könyvek és ajánlott olvasási sorrend

- [ ] A könyv adatainak lekérésekor az alkalmazás próbálja automatikusan felismerni a sorozatot és az ajánlott sorrendben elfoglalt helyét.
- [ ] A keresési találatban és a könyv adatlapján is jelenjen meg például: „3. az ajánlott olvasási sorrendben”.
- [ ] A kapcsolódó könyvek listája mutassa a teljes sorrendet, és jelezze, mely könyvek vannak meg, melyeket olvastam el, és melyek hiányoznak.
- [ ] Ha az adatforrás nem találja meg vagy tévesen jelöli a kapcsolatot, lehessen a sorrendet kézzel létrehozni és javítani.

Megjegyzés: az automatikus felismerés csak azoknál a könyveknél működhet, amelyekről az adatforrás tartalmaz sorozat- és sorrendadatot; ezért szükséges a kézi javítás lehetősége is.

