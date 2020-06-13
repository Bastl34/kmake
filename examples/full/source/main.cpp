#include "main.h"
#include "stuff/stuff.h"
#include "platform/platform.h"

#include <dep1.h>
#include <dep2.h>
#include <dep3.h>

#include <prebuilt.h>
#include <prebuiltDyn.h>

#include <fstream>
#include <string>

#ifndef _WIN32
#include <libgen.h>
#endif

#include <filesystem>

namespace fs = std::filesystem;

int readAsset()
{
    std::string assetDir = std::string(ASSET_DIR) + "/test/test2/test.txt";
    std::cout << "asset dir: " << assetDir.c_str() << std::endl;

    std::ifstream file(assetDir);
    if (file.is_open())
    {
        std::string line;
        while(getline(file,line))
        {
            std::cout << line << '\n';
        }
        file.close();
        return 0;
    }

    std::cout << "Unable to open file" << std::endl;
    return 1;
}

#ifndef __APPLE__
    std::string getWorkingDir()
    {
        return fs::current_path().u8string();
    }

    void changeWorkingDirFromExecPath(std::string path)
    {
        std::filesystem::current_path(fs::path(path).parent_path());
    }
#else
    #include <unistd.h>

    std::string getWorkingDir()
    {
        char buff[FILENAME_MAX];
        getcwd(buff, FILENAME_MAX);
        std::string current_working_dir(buff);
        return current_working_dir;
    }

    void changeWorkingDirFromExecPath(std::string path)
    {
        //get PWD env var
        char* pwd = std::getenv("PWD");

        //add PWD as prefix if needed
        if (pwd && path.substr(0,1) != "/")
        {
            //remove . if it's a relative path
            if (path.substr(0,1) == ".")
                path = path.substr(1);

            path = std::string(pwd) + path;
        }

        char* dir = &path[0];
        dir = dirname(dir);

        chdir(dir);
    }
#endif

int main(int const argc, const char* const argv[], char* envv[])
{
    std::cout << "main" << std::endl;
    std::cout << "TEST_TEST value: " << TEST_TEST << std::endl;
    std::cout << "HAS_THREADS value: " << HAS_THREADS << std::endl;
    std::cout << "HAS_IOSTREAM value: " << HAS_IOSTREAM << std::endl;

    std::string cwd = getWorkingDir();

    std::cout << "app dir: " << argv[0] << std::endl;
    std::cout << "current working dir: " << cwd << std::endl;

    //change workingdir to current execution dir
    changeWorkingDirFromExecPath(argv[0]);

    cwd = getWorkingDir();
    std::cout << "new working dir: " << cwd << std::endl;

    //test some funcs
    platformFunc();
    dep1Func();
    dep2Func();
    stuff();

    dep3Func1();
    dep3Func2();

    //test prebuild
    prebuiltFunc(1337);
    prebuiltDynFunc(1234);

    //test defines (via command line)
#ifdef TEST_DEF4
    std::cout << "should be 1: " << TEST_DEF4 << std::endl;
#endif

    return readAsset();
}
