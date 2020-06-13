.PHONY: clean clean_obj cleanobj

OBJS=

default: #DEFAULT_TARGET#

#INCLUDES#

clean:
	rm -rf bin obj

clean_obj:
	rm $(OBJS)

cleanobj: clean_obj
	@: