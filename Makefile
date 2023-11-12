# TODO: I should also build the tools as a dependency here. Currently even if I
# do that, the build system will not pick it up.

.PHONY: bench
bench: libdragon-install
	$(MAKE) -C ./src SOURCE_DIR=../src
.PHONY: clean-bench
clean-bench:
	$(MAKE) -C ./src clean

# Examples
# TODO: move these to libdragon for centralized dependency logic
.PHONY: audioplayer
audioplayer: libdragon-install
	$(MAKE) -C ./libdragon/examples/audioplayer SOURCE_DIR=$(CURDIR)/libdragon/examples/audioplayer
.PHONY: audioplayer-clean
audioplayer-clean:
	$(MAKE) -C ./libdragon/examples/audioplayer clean

.PHONY: cpptest
cpptest: libdragon-install
	$(MAKE) -C ./libdragon/examples/cpptest SOURCE_DIR=$(CURDIR)/libdragon/examples/cpptest
.PHONY: cpptest-clean
cpptest-clean:
	$(MAKE) -C ./libdragon/examples/cpptest clean

.PHONY: ctest
ctest: libdragon-install
	$(MAKE) -C ./libdragon/examples/ctest SOURCE_DIR=$(CURDIR)/libdragon/examples/ctest
.PHONY: ctest-clean
ctest-clean:
	$(MAKE) -C ./libdragon/examples/ctest clean

.PHONY: customfont
customfont: libdragon-install
	$(MAKE) -C ./libdragon/examples/customfont SOURCE_DIR=$(CURDIR)/libdragon/examples/customfont
.PHONY: customfont-clean
customfont-clean:
	$(MAKE) -C ./libdragon/examples/customfont clean

.PHONY: dfsdemo
dfsdemo: libdragon-install
	$(MAKE) -C ./libdragon/examples/dfsdemo SOURCE_DIR=$(CURDIR)/libdragon/examples/dfsdemo
.PHONY: dfsdemo-clean
dfsdemo-clean:
	$(MAKE) -C ./libdragon/examples/dfsdemo clean

.PHONY: eepromfstest
eepromfstest: libdragon-install
	$(MAKE) -C ./libdragon/examples/eepromfstest SOURCE_DIR=$(CURDIR)/libdragon/examples/eepromfstest
.PHONY: eepromfstest-clean
eepromfstest-clean:
	$(MAKE) -C ./libdragon/examples/eepromfstest clean

.PHONY: loadspritefromsd
loadspritefromsd: libdragon-install
	$(MAKE) -C ./libdragon/examples/loadspritefromsd SOURCE_DIR=$(CURDIR)/libdragon/examples/loadspritefromsd
.PHONY: loadspritefromsd-clean
loadspritefromsd-clean:
	$(MAKE) -C ./libdragon/examples/loadspritefromsd clean

.PHONY: mixertest
mixertest: libdragon-install
	$(MAKE) -C ./libdragon/examples/mixertest SOURCE_DIR=$(CURDIR)/libdragon/examples/mixertest
.PHONY: mixertest-clean
mixertest-clean:
	$(MAKE) -C ./libdragon/examples/mixertest clean

.PHONY: mptest
mptest: libdragon-install
	$(MAKE) -C ./libdragon/examples/mptest SOURCE_DIR=$(CURDIR)/libdragon/examples/mptest
.PHONY: mptest-clean
mptest-clean:
	$(MAKE) -C ./libdragon/examples/mptest clean

.PHONY: mputest
mputest: libdragon-install
	$(MAKE) -C ./libdragon/examples/mputest SOURCE_DIR=$(CURDIR)/libdragon/examples/mputest
.PHONY: mputest-clean
mputest-clean:
	$(MAKE) -C ./libdragon/examples/mputest clean

.PHONY: rspqdemo
rspqdemo: libdragon-install
	$(MAKE) -C ./libdragon/examples/rspqdemo SOURCE_DIR=$(CURDIR)/libdragon/examples/rspqdemo
.PHONY: rspqdemo-clean
rspqdemo-clean:
	$(MAKE) -C ./libdragon/examples/rspqdemo clean

.PHONY: rtc-test
rtctest: libdragon-install
	$(MAKE) -C ./libdragon/examples/rtctest SOURCE_DIR=$(CURDIR)/libdragon/examples/rtctest
.PHONY: rtc-test-clean
rtctest-clean:
	$(MAKE) -C ./libdragon/examples/rtctest clean

.PHONY: spritemap
spritemap: libdragon-install
	$(MAKE) -C ./libdragon/examples/spritemap SOURCE_DIR=$(CURDIR)/libdragon/examples/spritemap
.PHONY: spritemap-clean
spritemap-clean:
	$(MAKE) -C ./libdragon/examples/spritemap clean

.PHONY: test
test: libdragon-install
	$(MAKE) -C ./libdragon/examples/test SOURCE_DIR=$(CURDIR)/libdragon/examples/test
.PHONY: test-clean
test-clean:
	$(MAKE) -C ./libdragon/examples/test clean

.PHONY: timers
timers: libdragon-install
	$(MAKE) -C ./libdragon/examples/timers SOURCE_DIR=$(CURDIR)/libdragon/examples/timers
.PHONY: timers-clean
timers-clean:
	$(MAKE) -C ./libdragon/examples/timers clean

.PHONY: ucodetest
ucodetest: libdragon-install
	$(MAKE) -C ./libdragon/examples/ucodetest SOURCE_DIR=$(CURDIR)/libdragon/examples/ucodetest
.PHONY: ucodetest-clean
ucodetest-clean:
	$(MAKE) -C ./libdragon/examples/ucodetest clean

.PHONY: vrutest
vrutest: libdragon-install
	$(MAKE) -C ./libdragon/examples/vrutest SOURCE_DIR=$(CURDIR)/libdragon/examples/vrutest
.PHONY: vrutest-clean
vrutest-clean:
	$(MAKE) -C ./libdragon/examples/vrutest clean

.PHONY: vtest
vtest: libdragon-install
	$(MAKE) -C ./libdragon/examples/vtest SOURCE_DIR=$(CURDIR)/libdragon/examples/vtest
.PHONY: vtest-clean
vtest-clean:
	$(MAKE) -C ./libdragon/examples/vtest clean
# END Examples

.PHONY: examples
examples: audioplayer cpptest ctest customfont dfsdemo eepromfstest loadspritefromsd 
examples: mixertest mptest mputest rspqdemo rtctest spritemap test timers ucodetest
examples: vrutest vtest 

# TODO: enable this when libdragon examples supports BASE_DIR
# examples: libdragon-install
# 	$(MAKE) -C ./libdragon/examples BASE_DIR=$(CURDIR)/libdragon/examples

.PHONY: tests
tests: libdragon-install
	$(MAKE) -C ./libdragon/tests SOURCE_DIR=$(CURDIR)/libdragon/tests

# TODO: libdragon does not support custom SOURCE_DIR. We cannot change it
# even if we move that step here also
.PHONY: libdragon-install
libdragon-install:
	$(MAKE) -C ./libdragon install SOURCE_DIR=$(CURDIR)/libdragon/src

.PHONY: clean
clean: clean-bench
	$(MAKE) -C ./libdragon clean
	$(MAKE) -C ./libdragon/tests clean
	$(MAKE) -C ./libdragon/examples clean
