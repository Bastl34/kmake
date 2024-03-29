const os = require('os');

let globals =
{
    TEMPLATE_DIR: 'templates',

    // keep the order -> the order is used to find the "main" project for the build command
    PROJECT_TYPES:
    {
        main: 1,
        app: 2,
        framework: 3,
        static: 4,
        dynamic: 5
    },

    MAIN_CONFIG_ITEMS:
    [
        'workspace',
        'imports',
        'variables',
        'inputs',
        'checks'
    ],

    TEMPLATES:
    {
        'vs': 'vs',
        'vs2019': 'vs',
        'vs2022': 'vs',

        'mac': 'xcodeMac',
        'xcodemac': 'xcodeMac',
        'xcode': 'xcodeMac',

        'mk': 'makefile',
        'makefile': 'makefile',
        'Makefile': 'makefile'
    },

    WATCH_POSSIBILITIES:
    [
        'configs',
        'sources',
        'assets',
        'commands'
    ],

    // all supported archs
    // if archs is not supported -> not matching archs from kmake.yml are not applied
    // if you want to add a new template/arch add it here
    // the default target is based on the order
    ARCHS:
    {
        'xcodeMac': ['x86_64', 'arm64'],
        'vs': ['x64', 'win32'],
        'makefile': ['x86_64', 'x86'],

        // TODO
        // 'android': ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
        // 'ios': ['armv7', 'arm64', 'i386', 'x86_64']
    },

    //map of platform toolset versions for different versions of visual studio
    VISUAL_STUDIO_PLATFORM_TOOLSET_MAP:
    {
        'vs2022': 'v143',
        'vs2019': 'v142'
    },

    //used for visual studio version selector
    VISUAL_STUDIO_SOLUTION_VERSION_MAP:
    {
        'vs2022': '17',
        'vs2019': '16'
    },

    // only needed for arch names wich are different from the names of "ARCHS"
    ARCHS_MAP:
    {
        'g++':
        {
            'x86_64': 'x86-64',
            'x86': 'i386'
        },
        'clang++':
        {
            'x86': 'i386'
        }
    },

    ARCHS_FLAG_MAP:
    {
        'g++':
        {
            'x86_64': '-m64',
            'x86': '-m32'
        }
    },

    ARG_OPTIONS_DEFAULT:
    {
        'template': null,
        'output': null,

        'verbose': true,

        // use the default config if no config was provided
        'defaultConfig': true,

        'useInputCache': true,
        'cleanOutputDir': true,
        'skipAssets': false,
        'skipInput': false,
        'useDownloadCache': true,
        'useCheckCache': true,

        'define': [],
        'lib': [],
        'includePath': [],
        'libPath': [],
        'arch': [],
        'input': [],
        'embed': [],

        // make arguments
        'make': true,
        'open': false,

        // build arguments
        'build': false,
        'release': true,
        'buildProject': null,
        'binOutputDir': './bin',
        'buildAllArchs': false,
        'jobs': os.cpus().length,

        // run commands
        'commands': true,

        // run downloads
        'downloads': true,

        // watch arguments
        'watch': [],

        // export arguments
        'export': false,
        'exportDest': null,

        // run arguments
        'run': false,
        'killable': true,
        'runAsync': false,

        // the dev option will enable some settings: see ARG_OPTIONS_REQUREMENTS
        'dev': false,

        'version': false,
        'help': false
    },

    ARG_OPTIONS_SYNONYMS:
    {
        't': 'template',
        'o': 'output',

        've': 'verbose',

        // use the default config if no config was provided
        'dc': 'defaultConfig',

        'ic': 'useInputCache',
        'c': 'cleanOutputDir',
        'sa': 'skipAssets',
        'si': 'skipInput',
        'dlc': 'useDownloadCache',
        'chc': 'useCheckCache',

        // gcc style args
        // WARNING: other short/synonym parameters are not allowed to start with the first letter of the following
        // (because of the arg parser logic)
        'D': 'define',
        'l': 'lib',
        'I': 'includePath',
        'L': 'libPath',
        'a': 'arch',
        'in': 'input',
        'em': 'embed',

        // make arguments
        'm': 'make',
        'opn': 'open',

        // build arguments
        'b': 'build',
        'rel': 'release',
        'bp': 'buildProject',
        'bo': 'binOutputDir',
        'baa': 'buildAllArchs',
        'j': 'jobs',

        // run commands
        'cmd': 'commands',

        // run downloads
        'dls': 'downloads',

        // watch arguments
        'w': 'watch',
        'observe': 'watch', //this is because it's somehow not possible to use 'watch' or 'w' on windows in combination with nodemon

        // export arguments
        'e': 'export',
        'eout': 'exportDest',

        // run arguments
        'r': 'run',
        'k': 'killable',
        'ra': 'runAsync',

        // the dev option will enable some settings: see ARG_OPTIONS_REQUREMENTS
        'd': 'dev',

        'v': 'version',
        'h': 'help'
    },

    ARG_DESC:
    {
        'template': 'template name',
        'output': 'output directory (using "out" in your project dir as default)',

        'verbose': 'printing out more infos',

        'defaultConfig': 'if no config was set/found: use the default kmake.yml config',

        'useInputCache': 'do not ask for user input everytime',
        'cleanOutputDir': 'clear the output dir on workspace generation',
        'skipAssets': 'do not use the assets',
        'skipInput': 'do not use the inputs',
        'useDownloadCache': 'cache downloads',
        'useCheckCache': 'cache checks',

        'define': 'add preprocessor defines to all projects of the workspace',
        'lib': 'add a custom library to the project',
        'includePath': 'set include path\'s',
        'libPath': 'set library search path\'',
        'arch': 'specify the architecture of the output',
        'input': 'input variables/constants',
        'embed': 'add libarys wich should be embedded',

        'make': 'create project configuration files',
        'open': 'open the IDE project',

        'build': 'build the project',
        'release': 'use the release configuration (false for debug)',
        'buildProject': 'define the main project to be build',
        'binOutputDir': 'output dir of the binary files (only for xCode at the moment)',
        'buildAllArchs': 'build all possible architectures',
        'jobs': 'job amount for parallel execution (build)',

        'commands': 'execute the project specific commands',

        'downloads': 'run download tasks',

        'watch': 'watch the workspace for changes - and rebuild if build was set',

        'export': 'export the workspace/project to a zip or directory',
        'exportDest': 'ouput destination of the export (supports: zip, tar, tar.gz, dmg)',

        'run': 'run the project after a successful build',
        'killable': 'if the process is allowed to be killed by kmake',
        'runAsync': 'run the project async and to not wait for the process to end',

        'dev': 'development option - this enabled a some other build options',

        'version': 'prints the version',
        'help': 'prints the help',
    },

    // this references items of Global (this)
    ARG_POSSIBILITIES:
    {
        'template': 'TEMPLATES',
        'arch': 'ARCHS',
        'watch': 'WATCH_POSSIBILITIES'
    },

    ARG_OPTIONS_REQUREMENTS:
    {
        'export': ['make', 'build'],
        'run': ['make', 'build'],
        'build': ['make'],

        'dev':
        {
            'build': true,
            'run': true,
            'commands': true,
            'watch': true,
            'release': false,
            'verbose': false,
            'runAsync': true,
            'cleanOutputDir': false,
            'useInputCache': true
        }
    },

    CACHE_FILES:
    {
        INPUT: '.input.cache',
        DOWNLOAD: '.download.cache',
        CHECK: '.check.cache',
    },

    DEFAULT_TEMPLATE_BY_PLATFORM:
    {
        'darwin': 'xcodeMac',
        'win32': 'vs',
        'linux': 'makefile'
    },

    DEFAULT_OUTPUT_DIR: './out',
    DEFAULT_BIN_DIR: './bin',
    DEFAULT_OBJECTS_DIR: './obj',
    DEFAULT_TEMP_DIR: './tmp',

    DEFAULT_EXPORT_DIR: './export',

    DEFAULT_ASSET_DIR: 'assets',
    ASSET_DIRS_BY_TEMPLATE:
    {
        'vs': '../../assets',
        'xcodeMac': {generic: 'assets', app: '../Resources/assets', framework: '../Resources/assets'},
        'makefile': '../../../assets',
    },

    // the default target is based on the order
    CONFIGURATIONS: ['release', 'debug'],

    PLATFORM_RESOLVER:
    [
        'defines',
        'includePaths',
        'libPaths',
        'dependencies',
        'embedDependencies',
        'buildFlags',
        'linkerFlags',
        'downloads',
        'sources',
        'commands',

        // hooks
        'beforePrepare',
        'preBuild',
        'preLink',
        'postBuild',
        'afterPrepare'
    ],

    TEMP_DIRS:
    {
        test: 'testTemp',
        check: 'checkTemp',
    },

    DEFAULT_BUILD_SETTINGS:
    {
        // some generics
        DISPLAY_NAME: 'Test',

        // xcode settings
        MACOSX_DEPLOYMENT_TARGET: '10.15',
        GCC_C_LANGUAGE_STANDARD: 'gnu11',
        CLANG_CXX_LIBRARY: 'libc++',
        CLANG_CXX_LANGUAGE_STANDARD: 'gnu++17',
        ORGANIZATION_NAME: 'Test Org',
        PRODUCT_BUNDLE_IDENTIFIER: 'test.test.test',
        HUMAN_READABLE_COPYRIGHT: 'Copyright',
        BUNDLE_VERSION: '1.0.0',
        XCODE_BUILD_FLAGS: '',

        // visual studio settings
        VS_C_RUNTIME: 'MT', //MT or MD
        VS_LANGUAGE_STANDARD: 'stdcpp17',
        VS_BUILD_FLAGS: '',

        // makefile settings
        MK_CC: os.platform() == 'darwin' ? 'clang++' : 'g++',
        MK_MAKE: os.platform() == 'win32' ? 'mingw32-make' : 'make',
        MK_MAKE_FLAGS: '',
        MK_CC_DEFAULT_FLAGS: '-fPIC -Wall -Wno-unused-command-line-argument',
        MK_CPP_LANGUAGE_STANDARD: '-std=c++17',
        MK_C_LANGUAGE_STANDARD: '-std=c11',
        MK_STD_LIB: '-static-libstdc++ -lstdc++',
        MK_DEBUG_LEVEL: '-g',
        MK_OPTIMIZATION: '-O2',
        MK_VERBOSE: '',
        MK_AR_FLAGS: '-rvs'
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