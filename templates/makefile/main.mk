SYS_NAME := $(shell uname -s)

# CC
ifeq ($(SYS_NAME),Darwin)
  CC := clang++ -arch x86_64
else
  CC := g++
endif

#SOURCE_FILE#