# TODO: I should also build the tools as a dependency here. Currently even if I
# do that, the build system will not pick it up.

.PHONY: bench
bench: libdragon-install
	$(MAKE) -C ./src SOURCE_DIR=$(CURDIR)/src
.PHONY: clean-bench
clean-bench:
	$(MAKE) -C ./src clean

examples: libdragon-install
	$(MAKE) -C ./libdragon/examples BASE_DIR=$(CURDIR)/libdragon/examples

.PHONY: tests
tests: libdragon-install
	$(MAKE) -C ./libdragon/tests SOURCE_DIR=$(CURDIR)/libdragon/tests

.PHONY: libdragon-install
libdragon-install:
	$(MAKE) -C ./libdragon install SOURCE_DIR=$(CURDIR)/libdragon/src

.PHONY: clean
clean: clean-bench
	$(MAKE) -C ./libdragon clean
	$(MAKE) -C ./libdragon/tests clean
	$(MAKE) -C ./libdragon/examples clean
