bench: libdragon-install
	$(MAKE) -C ./src

examples: libdragon-install
	$(MAKE) -BC ./libdragon/examples

tests: libdragon-install
	$(MAKE) -BC ./libdragon/tests

libdragon-install: libdragon
	$(MAKE) -C ./libdragon install

libdragon:
	$(MAKE) -C ./libdragon

clean: clean-bench
	$(MAKE) -C ./libdragon clean
	$(MAKE) -C ./libdragon/tests clean
	$(MAKE) -C ./libdragon/tests clean

clean-bench:
	$(MAKE) -C ./src clean

.PHONY: bench examples tests libdragon-install libdragon clean clean-bench