#include <stdio.h>

#include <libdragon.h>

int main(void)
{
    init_interrupts();

    console_init();

    debug_init_usblog();
    console_set_debug(true);

    printf("Hello world!\n");

    while(1) {}
}