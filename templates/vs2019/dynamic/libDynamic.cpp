// libDynamic.cpp : Hiermit werden die exportierten Funktionen für die DLL definiert.
//

#include "pch.h"
#include "framework.h"
#include "libDynamic.h"


// Dies ist ein Beispiel für eine exportierte Variable.
LIBDYNAMIC_API int nlibDynamic=0;

// Dies ist ein Beispiel für eine exportierte Funktion.
LIBDYNAMIC_API int fnlibDynamic(void)
{
    return 0;
}

// Dies ist der Konstruktor einer Klasse, die exportiert wurde.
ClibDynamic::ClibDynamic()
{
    return;
}
