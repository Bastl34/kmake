#INCLUDES#

ifndef PROJECT_NAME_INCLUDED
PROJECT_NAME_INCLUDED = 1

PROJECT_NAME_CC := #MK_CC# #MK_VERBOSE#

OBJS+=#OBJECTS#

PROJECT_NAME_DEFINES=
PROJECT_NAME_INCLUDES=
PROJECT_NAME_LIB_PATHS=
PROJECT_NAME_CXX_FLAGS=#MK_CPP_LANGUAGE_STANDARD# #MK_STD_LIB#
PROJECT_NAME_C_FLAGS=#MK_C_LANGUAGE_STANDARD#
PROJECT_NAME_LDFLAGS= -shared

PROJECT_NAME_DEBUG=#MK_DEBUG_LEVEL#
PROJECT_NAME_RELEASE=#MK_OPTIMIZATION#

#TARGET_COMPILER#
#TARGET_DEFINES#
#TARGET_INCLUDES#
#TARGET_LIB_PATHS#
#TARGET_CXXFLAGS#
#TARGET_LDFLAGS#

PROJECT_NAME_PRE_FLAGS = $(PROJECT_NAME_DEFINES) $(PROJECT_NAME_INCLUDES) $(PROJECT_NAME_LIB_PATHS) #MK_CC_DEFAULT_FLAGS#
PROJECT_NAME_POST_FLAGS = $(PROJECT_NAME_LDFLAGS)


PROJECT_NAME_START:
	@echo ==================== PROJECT_NAME ====================

#TARGETS#

#HOOKS#

#COPY#

#ASSETS#

#SOURCE_FILE#

endif