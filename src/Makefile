V=1
D=1
BUILD_DIR=build
include $(N64_INST)/include/n64.mk

src=main.c

all: test_bench.z64

test_bench.z64: N64_ROM_TITLE="Testbench"
$(BUILD_DIR)/test_bench.elf: $(src:%.c=$(BUILD_DIR)/%.o)

clean:
	rm -f $(BUILD_DIR)/* test_bench.z64

-include $(wildcard $(BUILD_DIR)/*.d)

.PHONY: all clean
