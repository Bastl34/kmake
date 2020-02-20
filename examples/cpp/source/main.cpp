#include "main.h"
#include "stuff/stuff.h"

#include <dep1.h>
#include <dep2.h>

#include <prebuilt.h>
#include <prebuiltDyn.h>

int main()
{
    std::cout << "main" << std::endl;
    dep1Func();
    
    dep2Func();
    stuff();

    prebuiltFunc(1337);
    prebuiltDynFunc(1234);

    return 0;
}
