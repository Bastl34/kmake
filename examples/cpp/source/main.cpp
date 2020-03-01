#include "main.h"
#include "stuff/stuff.h"

#include <dep1.h>
#include <dep2.h>

#include <prebuilt.h>
#include <prebuiltDyn.h>

#include <fstream>
#include <string>

#include <filesystem>

namespace fs = std::filesystem;

int readAsset()
{
    std::ifstream file(std::string(ASSET_DIR) + "/assets/test/test2/test.txt");
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

int main(int const argc, const char* const argv[], char* envv[])
{
    std::cout << "main" << std::endl;

    std::string cwd = fs::current_path().u8string();
    
    std::cout << "app dir: " << argv[0] << std::endl;
    std::cout << "current working dir: " << cwd << std::endl;

    //change workingdir to current execution dir
    std::filesystem::current_path(fs::path(argv[0]).parent_path());

    //test some funcs
    dep1Func();
    dep2Func();
    stuff();

    //test prebuild
    prebuiltFunc(1337);
    prebuiltDynFunc(1234);

    //test defines (via command line)
#ifdef TEST_DEF4 
    std::cout << "should be 1: " << TEST_DEF4 << std::endl;
#endif

    return readAsset();
}
