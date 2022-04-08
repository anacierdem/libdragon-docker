bench: libdragon-install
	$(MAKE) -C ./src SOURCE_DIR=../src

# Examples
# TODO: move these to libdragon for centralized dependency logic
audioplayer: libdragon-install
	$(MAKE) -C ./libdragon/examples/audioplayer SOURCE_DIR=$(CURDIR)/libdragon/examples/audioplayer
audioplayer-clean:
	$(MAKE) -C ./libdragon/examples/audioplayer clean

cpptest: libdragon-install
	$(MAKE) -C ./libdragon/examples/cpptest SOURCE_DIR=$(CURDIR)/libdragon/examples/cpptest
cpptest-clean:
	$(MAKE) -C ./libdragon/examples/cpptest clean

ctest: libdragon-install
	$(MAKE) -C ./libdragon/examples/ctest SOURCE_DIR=$(CURDIR)/libdragon/examples/ctest
ctest-clean:
	$(MAKE) -C ./libdragon/examples/ctest clean

dfsdemo: libdragon-install
	$(MAKE) -BC ./libdragon/examples/dfsdemo
dfsdemo-clean:
	$(MAKE) -C ./libdragon/examples/dfsdemo clean

eepromfstest: libdragon-install
	$(MAKE) -C ./libdragon/examples/eepromfstest SOURCE_DIR=$(CURDIR)/libdragon/examples/eepromfstest
eepromfstest-clean:
	$(MAKE) -C ./libdragon/examples/eepromfstest clean

mixertest: libdragon-install
	$(MAKE) -C ./libdragon/examples/mixertest SOURCE_DIR=$(CURDIR)/libdragon/examples/mixertest
mixertest-clean:
	$(MAKE) -C ./libdragon/examples/mixertest clean

mptest: libdragon-install
	$(MAKE) -BC ./libdragon/examples/mptest
mptest-clean:
	$(MAKE) -C ./libdragon/examples/mptest clean

mputest: libdragon-install
	$(MAKE) -BC ./libdragon/examples/mputest
mputest-clean:
	$(MAKE) -C ./libdragon/examples/mputest clean

rtctest: libdragon-install
	$(MAKE) -C ./libdragon/examples/rtctest SOURCE_DIR=$(CURDIR)/libdragon/examples/rtctest
rtctest-clean:
	$(MAKE) -C ./libdragon/examples/rtctest clean

spritemap: libdragon-install
	$(MAKE) -C ./libdragon/examples/spritemap SOURCE_DIR=$(CURDIR)/libdragon/examples/spritemap
spritemap-clean:
	$(MAKE) -C ./libdragon/examples/spritemap clean

test: libdragon-install
	$(MAKE) -C ./libdragon/examples/test SOURCE_DIR=$(CURDIR)/libdragon/examples/test
test-clean:
	$(MAKE) -C ./libdragon/examples/test clean

timers: libdragon-install
	$(MAKE) -C ./libdragon/examples/timers SOURCE_DIR=$(CURDIR)/libdragon/examples/timers
timers-clean:
	$(MAKE) -C ./libdragon/examples/timers clean

ucodetest: libdragon-install
	$(MAKE) -C ./libdragon/examples/ucodetest SOURCE_DIR=$(CURDIR)/libdragon/examples/ucodetest
ucodetest-clean:
	$(MAKE) -C ./libdragon/examples/ucodetest clean

vrutest: libdragon-install
	$(MAKE) -BC ./libdragon/examples/vrutest
vrutest-clean:
	$(MAKE) -C ./libdragon/examples/vrutest clean

vtest: libdragon-install
	$(MAKE) -BC ./libdragon/examples/vtest
vtest-clean:
	$(MAKE) -C ./libdragon/examples/vtest clean
# END Examples

examples: audioplayer cpptest ctest dfsdemo eepromfstest mixertest mptest mputest
examples: rtctest spritemap test timers vrutest vtest ucodetest

tests: libdragon-install
	$(MAKE) -C ./libdragon/tests SOURCE_DIR=$(CURDIR)/libdragon/tests

libdragon-install: libdragon
	$(MAKE) -C ./libdragon install

# TODO: libdragon does not support cutom SOURCE_DIR
libdragon:
	$(MAKE) -C ./libdragon BUILD_DIR=$(CURDIR)/libdragon/build

clean: clean-bench
	$(MAKE) -C ./libdragon clean
	$(MAKE) -C ./libdragon/tests clean
	$(MAKE) -C ./libdragon/examples clean

clean-bench:
	$(MAKE) -C ./src clean

.PHONY: bench examples tests libdragon-install libdragon clean clean-bench

.PHONY: audioplayer cpptest ctest dfsdemo eepromfstest mixertest mptest mputest
.PHONY: rtctest spritemap test timers vrutest vtest ucodetest
