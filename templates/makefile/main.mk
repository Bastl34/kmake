SYS_NAME := $(shell uname -s)

# CC
ifeq ($(SYS_NAME),Darwin)
	CC := clang++ -arch x86_64 #MK_VERBOSE#
else
	CC := g++ #MK_VERBOSE#
endif


DEFINES=
INCLUDES=
LIB_PATHS=
CXXFLAGS=#MK_CPP_LANGUAGE_STANDARD# #MK_STD_LIB#
CFLAGS=#MK_C_LANGUAGE_STANDARD#
LDFLAGS=

DEBUG=#MK_DEBUG_LEVEL#
RELEASE=#MK_OPTIMIZATION#

PRE_FLAGS = $(DEFINES) $(INCLUDES) $(LIB_PATHS) $(CXXFLAGS) #MK_DEFAULT_FLAGS#
POST_FLAGS = $(LDFLAGS)

#TARGET_DEFINES#
#TARGET_INCLUDES#
#TARGET_LIB_PATHS#
#TARGET_CXXFLAGS#
#TARGET_LDFLAGS#

default: #DEFAULT_TARGET#

#TARGETS#

#HOOKS#

#SOURCE_FILE#