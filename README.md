WebDirt is a rewrite of Alex McLean's Dirt sampling engine (by Alex McLean) to run in the web browser
using the Web Audio API. Contributors are Jamie Beverley and David Ogborn. It was created for (and can be tried, live, in) the Estuary live coding platform: https://github.com/dktr0/Estuary.git

From a JavaScript point of view it is used as follows.

1. Make a WebDirt object:
```
webDirt = new WebDirt();
```

2. Then, you can play samples in 4 ways:
```
webDirt.playSample(msg); // play an individual sample
webDirt.playScore(score); // play an array of messages (a score)
webDirt.loadAndPlayScore(url); // load a score from an arbitrary URL and play it when ready
webDirt.subscribeToTidalSocket(url,withLog); // subscribe to a TidalSocket over WebSockets, logging is off if withLog == false
```  

You can preload a given sample (name and number) into WebDirt's sample bank to make sure it is available for immediate use:
```
var fileName = webDirt.getFilename("mySample",7);
webDirt.sampleBank.load(fileName); // to preload the 8th sample in the sample folder indexed by 'name'
```

The best places for questions and discussion about WebDirt is the #estuary channel at https://chat.toplap.org or the Estuary Google group at https://groups.google.com/forum/#!forum/estuary.
