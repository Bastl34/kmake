let globals =
{
    TEMPLATE_DIR: 'templates',
    PROJECT_TYPES:
    {
        main: 1,
        static: 2,
        dynamic: 3
    },

    TEMPLATES:
    {
        "xcodeMac": "xcodeMac"
    },

    PLATFORMS:
    {
        "mac": ["x86_64"],
        "win": ["win32", "x64"],
        "linux": ["x86", "x86_64", "arm", "arm64"],
        "android": ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"],
        "ios": ["armv7", "arm64", "i386", "x86_64"],
    }
};

module.exports = globals;
