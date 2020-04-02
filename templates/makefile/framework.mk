#INCLUDES#

clean:
	rm -rf bin obj

clean_obj:
	find . -name "*.o" -type f -delete