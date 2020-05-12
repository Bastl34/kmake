#ifndef PREBUILT_DYN
#define PREBUILT_DYN

#if defined PROJECT_PREBUILTDYN && defined _WIN32
#define PREBUILTDYN_EXPORTS __declspec(dllexport)
#elif defined __WIN32
#define PREBUILTDYN_EXPORTS __declspec(dllimport)
#else
#define PREBUILTDYN_EXPORTS
#endif

PREBUILTDYN_EXPORTS void prebuiltDynFunc(int input);

#endif
