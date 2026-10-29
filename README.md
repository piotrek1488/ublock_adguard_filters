# ublock_adguard_filters

Moje filtry do uBlock Origin. Repo skleja własne listy i kilka list zewnętrznych w jeden plik, który uBO może zasubskrybować pod stałym adresem. GitHub Actions odświeża ten plik automatycznie.

## Jak dodać listę w uBlock Origin

1. Otwórz Dashboard → Filter lists → Import.
2. Wklej adres:

   ```
   https://raw.githubusercontent.com/piotrek1488/ublock_adguard_filters/main/dist/combined.txt
   ```

3. Kliknij Apply changes.

Jeśli masz już włączone listy, które są w `sources.txt` (Polish Annoyance Filters, MajkiIT, YouTube z EasyList itd.), wyłącz je w uBO. Inaczej reguły będą się dublować.

Składnia reguł jest uBO-specyficzna (`:style()`, `##+js(...)`). Zgodność z AdGuard nie była testowana.

## Struktura repo

```
├── lists/                          <- moje listy (edytuję tylko te pliki)
│   ├── filters.txt                 <- ogólne filtry, pogrupowane po stronach
│   └── polsatnews_darkmode.txt     <- tryb ciemny dla polsatnews.pl
├── sources.txt                     <- które listy skleić, po kolei
├── header.txt                      <- nagłówek wynikowej listy (Title, Expires)
├── scripts/build.py                <- skrypt sklejający (sama biblioteka standardowa Pythona)
├── dist/combined.txt               <- wynik, NIE edytować ręcznie
└── .github/workflows/build.yml     <- automatyczny build
```

## Jak to działa

`scripts/build.py` czyta `sources.txt` i skleja wszystkie źródła w `dist/combined.txt`. Źródłem może być:

- lokalna ścieżka względem roota repo (działa też dla submodułów gita),
- adres `https://`, pobierany przy każdym buildzie.

Co robi skrypt:

- rozwija `!#include` (uBO nie rozwiąże go po sklejeniu listy w jeden plik). Obowiązuje ta sama zasada co w uBO: plik w tym samym katalogu lub podkatalogu, bez `../` i bez pełnych adresów,
- usuwa metadane poszczególnych list (`Title`, `Version`, `Expires`, `Last modified`, `Checksum` itp.), a zamiast nich wstawia `header.txt`,
- usuwa duplikaty filtrów. Filtry wewnątrz `!#if … !#endif` zostają nietknięte,
- przed każdym źródłem wstawia komentarz `! ---- source: … ----`, żeby było widać, skąd pochodzi dany fragment,
- daje deterministyczny wynik (bez timestampów), więc commit powstaje tylko przy prawdziwej zmianie,
- przy błędzie (404, brak pliku, `http://` zamiast `https://`) kończy się kodem 1 i nie nadpisuje poprzedniego pliku wynikowego.

## Automatyczny build (GitHub Actions)

Workflow `.github/workflows/build.yml` uruchamia się:

- po pushu na `main` (np. po zmergowaniu zmiany), ale tylko gdy zmieniło się `lists/`, `sources.txt`, `header.txt`, `scripts/` albo sam workflow,
- codziennie o 3:17 UTC, żeby odświeżyć listy zewnętrzne,
- ręcznie (workflow_dispatch).

Po zbudowaniu workflow commituje `dist/combined.txt` na `main`, ale tylko jeśli plik się zmienił. Commit od bota nie uruchamia workflow ponownie.

Uwagi:

- Jeśli `main` ma branch protection, bot nie zapisze tam zmian. Trzeba dodać dla niego wyjątek albo publikować np. przez GitHub Pages.
- GitHub wyłącza zadania z harmonogramu po ok. 60 dniach bez aktywności w repo. Commity bota tego nie resetują, więc czasem trzeba odpalić workflow ręcznie.

## Codzienne zadania

### Dodanie własnego filtra

Dopisz go w `lists/filters.txt` w sekcji odpowiedniej strony (`! ===== strona =====`). Kolejność w sekcji: `###id`, klasy, inne selektory, scriptlety (`+js`), reguły sieciowe (`||…`). Po zmergowaniu do `main` Action przebuduje `dist/combined.txt`.

### Dodanie listy zewnętrznej albo własnego pliku

Dopisz adres `https://…` albo ścieżkę (np. `lists/nowa.txt`) do `sources.txt`. Kolejność ma znaczenie tylko dla usuwania duplikatów.

### Budowanie lokalnie

```bash
python3 scripts/build.py
```

Opcjonalnie:

```bash
python3 scripts/build.py --sources sources.txt --header header.txt --out dist/combined.txt
```

## Czego nie dodawać

Listy wyjątków (reguły `@@`, np. „whitelist" Interii) wyłączyłyby filtrowanie na całych stronach, także te reguły z `lists/filters.txt`. Takiej listy nie ma w `sources.txt` celowo. Adresy zawierające osobiste tokeny (np. `?hash=`) nie powinny trafiać do repo.
