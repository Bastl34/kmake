#include "main.h"
#include "stuff/stuff.h"

#include <lib1.h>
#include <lib2.h>

int main()
{
    std::cout << "main" << std::endl;
    lib1Func();
    lib2Func();
    stuff();

    return 0;
}