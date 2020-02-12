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
        'mac': 'xcodeMac',
        'xcodemac': 'xcodeMac'
    },

    //all supported platforms
    //if platform is not supported -> not matching plafroms from kmake.yml are not applied
    //if you want to add a new platform/arch add it here
    PLATFORMS:
    {
        'xcodeMac': ['x86_64'],
        'vs2019': ['win32', 'x64'],
        'makefile': ['x86', 'x86_64', 'arm', 'arm64'],
        'android': ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
        'ios': ['armv7', 'arm64', 'i386', 'x86_64']
    },

    DEFAULT_TEMPLATE_BY_PLATFORM:
    {
        'darwin': 'xcodeMac',
        'win32': 'vs2019',
        'linux': 'makefile'
    },

    DEFAULT_OUTPUT_DIR: './out',

    CONFIGURATIONS: ['debug', 'release'],

    PLATFORM_RESOLVER: ['defines', 'includePaths', 'libPaths', 'dependencies', 'buildFlags', 'linkerFlags'],

    DEFAULT_BUILD_SETTINGS:
    {
        //xcode settings
        MACOSX_DEPLOYMENT_TARGET: '10.14',
        GCC_C_LANGUAGE_STANDARD: 'gnu11',
        CLANG_CXX_LIBRARY: 'libc++',
        CLANG_CXX_LANGUAGE_STANDARD: 'gnu++14',
        ORGANIZATION_NAME: 'Test Org',
        PRODUCT_BUNDLE_IDENTIFIER: 'test.test.test',
        HUMAN_READABLE_COPYRIGHT: 'Copyright',
        BUNDLE_VERSION: '1.0.0'
    },

    ICON: 'resources/defaultIcon.png',

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