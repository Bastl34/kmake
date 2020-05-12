#pragma once

#include <iostream>

#if defined PROJECT_DEP2 && defined _WIN32
    #define DEP2_EXPORTS __declspec(dllexport)
#elif defined __WIN32
    #define DEP2_EXPORTS __declspec(dllimport)
#else
    #define DEP2_EXPORTS
#endif

DEP2_EXPORTS void dep2Func();