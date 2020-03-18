let globals =
{
    TEMPLATE_DIR: 'templates',

    //keep the order -> the order is used to find the "main" project for the build command
    PROJECT_TYPES:
    {
        main: 1,
        app: 2,
        framework: 3,
        static: 4,
        dynamic: 5
    },

    TEMPLATES:
    {
        'vs': 'vs2019',
        'vs2019': 'vs2019',

        'mac': 'xcodeMac',
        'xcodemac': 'xcodeMac',

        'mk': 'makefile',
        'makefile': 'makefile',
        'Makefile': 'makefile'
    },

    //all supported archs
    //if archs is not supported -> not matching archs from kmake.yml are not applied
    //if you want to add a new template/arch add it here
    //the default target is based on the order
    ARCHS:
    {
        'xcodeMac': ['x86_64'],
        'vs2019': ['x64', 'win32'],
        'makefile': ['x86_64', 'x86', 'arm', 'arm64'],

        //TODO
        'android': ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
        'ios': ['armv7', 'arm64', 'i386', 'x86_64']
    },

    ARG_OPTIONS_DEFAULT:
    {
        'useInputCache': false,
        'cleanOutputDir': true,

        'define': [],
        'lib': [],
        'includePath': [],
        'libPath': [],

        //build arguments
        'build': false,
        'release': true,
        'buildProject': null,
        'binOutputDir': './bin',

        //watch arguments
        'watch': false,
        'watchCmd': '',

        //export arguments
        'export': false

        //run arguments
    },

    DEFAULT_TEMPLATE_BY_PLATFORM:
    {
        'darwin': 'xcodeMac',
        'win32': 'vs2019',
        'linux': 'makefile'
    },

    DEFAULT_OUTPUT_DIR: './out',
    DEFAULT_BIN_DIR: './bin',
    DEFAULT_OBJECTS_DIR: './obj',

    //the default target is based on the order
    CONFIGURATIONS: ['release', 'debug'],

    PLATFORM_RESOLVER:
    [
        'defines',
        'includePaths',
        'libPaths',
        'dependencies',
        'buildFlags',
        'linkerFlags',

        //hooks
        'beforePrepare',
        'preBuild',
        'preLink',
        'postBuild',
        'afterPrepare'
    ],

    DEFAULT_BUILD_SETTINGS:
    {
        //some generics
        DISPLAY_NAME: 'Test',

        //xcode settings
        MACOSX_DEPLOYMENT_TARGET: '10.15',
        GCC_C_LANGUAGE_STANDARD: 'gnu11',
        CLANG_CXX_LIBRARY: 'libc++',
        CLANG_CXX_LANGUAGE_STANDARD: 'gnu++17',
        ORGANIZATION_NAME: 'Test Org',
        PRODUCT_BUNDLE_IDENTIFIER: 'test.test.test',
        HUMAN_READABLE_COPYRIGHT: 'Copyright',
        BUNDLE_VERSION: '1.0.0',

        //visual studio settings
        VS_C_RUNTIME: 'MT', //MT or MD
        VS_LANGUAGE_STANDARD: 'stdcpp17',

        //makefile settings
        MK_DEFAULT_FLAGS: '-fPIC -Wall -Wno-unused-command-line-argument',
        MK_CPP_LANGUAGE_STANDARD: 'std=c++17',
        MK_C_LANGUAGE_STANDARD: 'std=c11',
        MK_STD_LIB: 'static-libstdc++',
        MK_DEBUG_LEVEL: 'g',
        MK_OPTIMIZATION: 'O2',
        MK_VERBOSE: '',
        MK_AR_FLAGS: 'rvs'
    },

    ICON: 'resources/defaultIcon.png',

    DEFAULT_ASSET_DIR: 'assets',
    ASSET_DIRS_BY_TEMPLATE:
    {
        'vs2019': '../..',
        'xcodeMac': '../Resources',
        'makefile': '../../..',
    },

    XCODE_ICONS:
    {
        mac:
        [
            {name: '16x16', scale: '1x', size: 16},
            {name: '16x16', scale: '2x', size: 32},
            {name: '32x32', scale: '1x', size: 32},
            {name: '32x32', scale: '2x', size: 64},
            {name: '128x128', scale: '1x', size: 128},
            {name: '128x128', scale: '2x', size: 256},
            {name: '256x256', scale: '1x', size: 256},
            {name: '256x256', scale: '2x', size: 512},
            {name: '512x512', scale: '1x', size: 512},
            {name: '512x512', scale: '2x', size: 1024}
        ],
        iphone:
        [
            {name: '20x20', scale: '2x', size: 40},
            {name: '20x20', scale: '3x', size: 60},
            {name: '29x29', scale: '2x', size: 58},
            {name: '29x29', scale: '3x', size: 87},
            {name: '40x40', scale: '2x', size: 80},
            {name: '40x40', scale: '3x', size: 120},
            {name: '60x60', scale: '2x', size: 120},
            {name: '60x60', scale: '3x', size: 180}
        ],
        ipad:
        [
            {name: '20x20', scale: '1x', size: 20},
            {name: '20x20', scale: '2x', size: 40},
            {name: '29x29', scale: '1x', size: 29},
            {name: '29x29', scale: '2x', size: 58},
            {name: '40x40', scale: '1x', size: 40},
            {name: '40x40', scale: '2x', size: 80},
            {name: '76x76', scale: '1x', size: 76},
            {name: '76x76', scale: '2x', size: 152},
            {name: '83.5x83.5', scale: '2x', size: 167}
        ],
        'ios-marketing':
        [
            {name: '1024x1024', scale: '1x', size: 1024}
        ]
    }
};

module.exports = globals;