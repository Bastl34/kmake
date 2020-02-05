#include "main.h"
#include "stuff/stuff.h"

#include <dep1.h>
#include <dep2.h>

int main()
{
    std::cout << "main" << std::endl;
    dep1Func();
    dep2Func();
    stuff();

    return 0;
}