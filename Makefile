bench: libdragon
	make -C ./src

examples: libdragon-install
	make -BC ./libdragon-source/examples

tests: libdragon-install
	make -BC ./libdragon-source/tests

libdragon-install: libdragon
	make -C ./libdragon-source install

libdragon:
	make -C ./libdragon-source

clean: clean-bench
	make -C ./libdragon-source clean
	make -C ./libdragon-source/tests clean
	make -C ./libdragon-source/tests clean

clean-bench:
	make -C ./src clean

.PHONY: bench examples tests libdragon-install libdragon clean clean-bench