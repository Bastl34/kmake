#ifeq ($(wildcard $(addsuffix /rm,$(subst :, ,$(PATH)))),)
ifeq ($(OS),Windows_NT)
	CELAN = del /s bin obj
	CLEAN_OBJ = del /s *.o
else
	CELAN = rm -rf bin obj
	CLEAN_OBJ = find . -name "*.o" -type f -delete
endif


default: #DEFAULT_TARGET#

#INCLUDES#

clean:
	$(CELAN)

clean_obj:
	$(CLEAN_OBJ)