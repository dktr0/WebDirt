WebDirt is a loose re-creation/fork of Alex McLean's Dirt sampling engine to run in the web browser, using the Web Audio API. It was originally created by Jamie Beverly and David Ogborn for the Estuary collaborative live coding platform, is currently maintained by David Ogborn, and can be tried, live, at https://estuary.mcmaster.ca (eg. by entering some TidalCycles code into a box with MiniTidal selected as the language).

Here are some simple examples (note: assuming ES6 modules) of how WebDirt might be used from a JavaScript point of view:

```
// import webpacked library
import * as WebDirt from './WebDirt/WebDirt-packed.js';

// create a WebDirt object and initialize Web Audio context
window.webDirt = new WebDirt.WebDirt({
  sampleMapUrl: "samples/sampleMap.json",
  sampleFolder: "samples"
});
window.webDirt.initializeWebAudio();

// play a sample from sample library using WebDirt
window.webDirt.playSample({ s: "gtr", n: "0"});
```

The best places for questions and discussion about WebDirt is the Estuary discord server.
