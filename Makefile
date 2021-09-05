bench: libdragon-install
	$(MAKE) -C ./src

examples: libdragon-install
	$(MAKE) -BC ./libdragon-source/examples

tests: libdragon-install
	$(MAKE) -BC ./libdragon-source/tests

libdragon-install: libdragon
	$(MAKE) -C ./libdragon-source install

libdragon:
	$(MAKE) -C ./libdragon-source

clean: clean-bench
	$(MAKE) -C ./libdragon-source clean
	$(MAKE) -C ./libdragon-source/tests clean
	$(MAKE) -C ./libdragon-source/tests clean

clean-bench:
	$(MAKE) -C ./src clean

.PHONY: bench examples tests libdragon-install libdragon clean clean-bench