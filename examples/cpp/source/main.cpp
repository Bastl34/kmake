#include "main.h"
#include "stuff/stuff.h"

#include <dep1.h>
#include <dep2.h>

#include <prebuilt.h>
#include <prebuiltDyn.h>

#include <fstream>
#include <string>
#include <unistd.h>
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

    char cwd[10240];
    getcwd(cwd, sizeof(cwd));

    std::cout << "app dir: " << argv[0] << std::endl;
    std::cout << "current working dir: " << cwd << std::endl;

    //change workingdir to current execution dir
    chdir(fs::path(argv[0]).parent_path().c_str());

    dep1Func();

    dep2Func();
    stuff();

    prebuiltFunc(1337);
    prebuiltDynFunc(1234);

    return readAsset();
}
