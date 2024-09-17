npm run pack

mkdir tmp

mv libdragon-linux ./tmp/libdragon
tar -C ./tmp -cvzf libdragon-linux-x86_64.tar.gz libdragon
rm ./tmp/libdragon

mv libdragon-macos ./tmp/libdragon
tar -C ./tmp -cvzf libdragon-macos-x86_64.tar.gz libdragon
rm ./tmp/libdragon

mv libdragon-win.exe ./tmp/libdragon.exe
Compress-Archive -Path ./tmp/libdragon.exe -DestinationPath libdragon-win-x86_64.zip

iscc setup.iss /dMyAppVersion=$args