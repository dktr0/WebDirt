WebDirt is a loose re-creation/fork of Alex McLean's Dirt sampling engine to run in the web browser, using the Web Audio API. It was originally created by Jamie Beverley and David Ogborn for the Estuary collaborative live coding platform, is currently maintained by David Ogborn, and can be tried, live, at https://estuary.mcmaster.ca (eg. by entering some TidalCycles code into a box with MiniTidal selected as the language).

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

Notes: the "sampleMap.json" file reference in the above code is NOT the same thing as the "reslist" files used by Estuary. A sampleMap is usually generated by the script makeSampleMap.sh in the "old" folder of this repository - such sample maps are used for circumstances where WebDirt is, itself, managing access to sound files. By contrast, when WebDirt is used within Estuary, Estuary's on-the-fly resource system manages sound files, etc and passes samples to WebDirt using the buffer parameter of playSample rather than the s and n parameters. There is an example of how to generate a sample map in the purescript-webdirt-README.md file, which also has discussion/examples of how WebDirt can be used from PureScript (via the purescript-webdirt library whose whom is also this repository).

The best places for questions and discussion about WebDirt is the Estuary discord server.
