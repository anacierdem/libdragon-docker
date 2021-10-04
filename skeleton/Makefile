V=1
SOURCE_DIR=src
BUILD_DIR=build
include $(N64_INST)/include/n64.mk

src=main.c

all: hello.z64

hello.z64: N64_ROM_TITLE="Hello World"
$(BUILD_DIR)/hello.elf: $(src:%.c=$(BUILD_DIR)/%.o)

clean:
	rm -f $(BUILD_DIR)/* hello.z64

-include $(wildcard $(BUILD_DIR)/*.d)

.PHONY: all clean
