# JFIFtoJPGConverter
Simple chrome extension to convert downloaded images in the JFIF format to a JPG upon download.

# Features
Detects completed downloads whose filename ends with .jfif (case-insensitive).

Converts the image bytes to JPEG using an OffscreenCanvas (keeps you entirely in-browser).

Saves a new .jpg download with the same base name.

Attempts to delete the original .jfif file from disk using chrome.downloads.removeFile() (may fail on some OSes; not fatal).

# Installation (developer / local)

Put the extension files into a folder, e.g. jfif-to-jpg-extension/.

Open Chrome and go to chrome://extensions.

Enable Developer mode (top-right).

Click Load unpacked and select your extension folder.

Inspect the background service worker console via the extension card → service worker → Inspect to see logs.
