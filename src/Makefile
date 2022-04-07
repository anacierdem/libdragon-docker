V=1
D=1
BUILD_DIR=build
include $(N64_INST)/include/n64.mk

all: test_bench.z64
.PHONY: all

OBJS = $(BUILD_DIR)/main.o

test_bench.z64: N64_ROM_TITLE="Testbench"
$(BUILD_DIR)/test_bench.elf: $(OBJS)

clean:
	rm -f $(BUILD_DIR)/* test_bench.z64
.PHONY: clean

-include $(wildcard $(BUILD_DIR)/*.d)