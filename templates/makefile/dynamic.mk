SYS_NAME := $(shell uname -s)

# CC
ifeq ($(SYS_NAME),Darwin)
  CC := clang++ -arch x86_64
else
  CC := g++
endif

DEFINES=
INCLUDES=
LIB_PATHS=
CXXFLAGS=
LDFLAGS= -shared

#DEFINES#
#INCLUDES#
#LIB_PATHS#
#CXXFLAGS#
#LDFLAGS#

default: #DEFAULT_TARGET#

#TARGETS#

#SOURCE_FILE#