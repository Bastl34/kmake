#INCLUDES#

clean:
	rm -rf bin obj

clean_obj:
	ifeq ($(OS),Windows_NT)
		#del /s *.o *.d *.elf *.map *.log
		del /s *.o
	else
		find . -name "*.o" -type f -delete
	endif