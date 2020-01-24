// Der folgende ifdef-Block ist die Standardmethode zum Erstellen von Makros, die das Exportieren
// aus einer DLL vereinfachen. Alle Dateien in dieser DLL werden mit dem LIBDYNAMIC_EXPORTS-Symbol
// (in der Befehlszeile definiert) kompiliert. Dieses Symbol darf für kein Projekt definiert werden,
// das diese DLL verwendet. Alle anderen Projekte, deren Quelldateien diese Datei beinhalten, sehen
// LIBDYNAMIC_API-Funktionen als aus einer DLL importiert an, während diese DLL
// mit diesem Makro definierte Symbole als exportiert ansieht.
#ifdef LIBDYNAMIC_EXPORTS
#define LIBDYNAMIC_API __declspec(dllexport)
#else
#define LIBDYNAMIC_API __declspec(dllimport)
#endif

// Diese Klasse wird aus der DLL exportiert.
class LIBDYNAMIC_API ClibDynamic {
public:
	ClibDynamic(void);
	// TODO: Methoden hier hinzufügen.
};

extern LIBDYNAMIC_API int nlibDynamic;

LIBDYNAMIC_API int fnlibDynamic(void);
