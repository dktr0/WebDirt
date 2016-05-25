WebDirt is a rewrite of Alex McLean's Dirt sampling engine (by Alex McLean) to run in the web browser
using the Web Audio API. Contributors are Jamie Beverley and David Ogborn.

From a JavaScript point of view it is used as follows.

1. Make a WebDirt object:
```
webDirt = new WebDirt();
```

2. Then, you can play samples in 4 ways:
```
webDirt.queue(msg); // play an individual sample
webDirt.playScore(score); // play an array of messages (a score)
webDirt.loadAndPlayScore(url); // load a score from an arbitrary URL and play it when ready
webDirt.subscribeToTidalSocket(url,withLog); // subscribe to a TidalSocket over WebSockets, logging is off if withLog == false
```  

You can preload a given sample (name and number) into WebDirt's sample bank to make sure it is available for immediate use:
```
webDirt.sampleBank.load("name",7); // to preload the 8th sample in the sample folder indexed by 'name'
```

For running test.html in Chrome, open Chrome with tags:

OS X:  open -a 'Google Chrome' --args -allow-file-access-from-files

Windows:  C:\ ... \Application\chrome.exe --allow-file-access-from-files

More info soon!!
