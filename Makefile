.PHONY: bench
bench:
	$(MAKE) -C ./src SOURCE_DIR=$(CURDIR)/src
.PHONY: clean-bench
clean-bench:
	$(MAKE) -C ./src clean
