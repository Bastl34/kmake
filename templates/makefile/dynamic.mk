SYS_NAME := $(shell uname -s)

# CC
ifeq ($(SYS_NAME),Darwin)
	CC := clang++ -arch x86_64 #MK_VERBOSE#
else
	CC := g++
endif

DEFINES=
INCLUDES=
LIB_PATHS=
CXXFLAGS=#MK_CPP_LANGUAGE_STANDARD# #MK_STD_LIB#
CFLAGS=#MK_C_LANGUAGE_STANDARD#
LDFLAGS= -shared

DEBUG=#MK_DEBUG_LEVEL#
RELEASE=#MK_OPTIMIZATION#

#TARGET_DEFINES#
#TARGET_INCLUDES#
#TARGET_LIB_PATHS#
#TARGET_CXXFLAGS#
#TARGET_LDFLAGS#

PRE_FLAGS = $(DEFINES) $(INCLUDES) $(LIB_PATHS) $(CXXFLAGS) #MK_DEFAULT_FLAGS#
POST_FLAGS = $(LDFLAGS)

default: #DEFAULT_TARGET#

#TARGETS#

#SOURCE_FILE#