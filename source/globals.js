let globals =
{
    TEMPLATE_DIR: 'templates',
    PROJECT_TYPES:
    {
        main: 1,
        static: 2,
        dynamic: 3
    },

    HOOKS:
    {
        beforePrepare: 0,
        afterPrepare: 1
    },

    TEMPLATES:
    {
        "mac": "xcodeMac",
        "xcodemac": "xcodeMac"
    },

    //all supported platforms
    //if platform is not supported -> not matching plafroms from kmake.yml are not applied
    //if you want to add a new platform/arch add it here
    PLATFORMS:
    {
        "xcodeMac": ["x86_64"],
        "vs2019": ["win32", "x64"],
        "makefile": ["x86", "x86_64", "arm", "arm64"],
        "android": ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"],
        "ios": ["armv7", "arm64", "i386", "x86_64"],
    },

    CONFIGURATIONS: ["debug", "release"],

    PLATFORM_RESOLVER: ["defines", "includePaths", "libPaths", "dependencies", "buildFlags", "linkerFlags"],
};

module.exports = globals;
