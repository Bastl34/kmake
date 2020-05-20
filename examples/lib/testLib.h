#ifndef TESTLIB
#define TESTLIB

#if defined PROJECT_TESTLIB && defined _WIN32
#define TESTLIB_EXPORTS __declspec(dllexport)
#elif defined __WIN32
#define TESTLIB_EXPORTS __declspec(dllimport)
#else
#define TESTLIB_EXPORTS
#endif

TESTLIB_EXPORTS void testLibFunc(int input);

#endif
