npm run pack
tar --transform='s/-linux//' -cvzf libdragon-linux-x86_64.tar.gz libdragon-linux
tar --transform='s/-macos//' -cvzf libdragon-macos-x86_64.tar.gz libdragon-macos
mv libdragon-win.exe libdragon.exe
zip libdragon-win-x86_64.zip libdragon.exe
