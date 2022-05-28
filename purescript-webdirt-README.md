# purescript-webdirt

WebDirt as a PureScript library

By way of notes about how to integrate it, an example of a from scratch web page that makes sound using this all...

Make a new empty PureScript project:

```
mkdir aProject
cd aProject
spago init
```

Since this PureScript library is not part of the default package set, it needs to be added to packages.dhall... TODO (just working out an issue with accessing a purescript package from a subfolder of a repository...)

Get WebDirt-packed.js and AudioWorklets.js from the dist folder of the WebDirt repository and place them where you'll be serving from.

Here's an example Main.purs for the project:
```
module Main where

import Prelude
import Effect (Effect)
import WebDirt
import Option (fromRecord')

main :: Effect Unit
main = pure unit

launch :: Effect WebDirt
launch = do
  webDirt <- newWebDirt $ fromRecord' { sampleMapUrl: "samples/sampleMap.json", sampleFolder: "samples" }
  initializeWebAudio webDirt
  pure webDirt
```

Build the above with spago bundle-app and make sure the index.js is available where you are serving from.

Here's an example index.html for the project - make it available from where you are serving from:

```
<html>
<body onload="wd=PS['Main'].launch()">
 <script src="./WebDirt-packed.js"></script>
 <script src="./index.js"></script>
 <button onclick="PS['Main'].makeASound(wd)()">Press Me</button>
</body>
</html>
```

The above assumes that an old-style sample map (made with script makeSampleMap.sh in the old folder of WebDirt repository) is at the location samples/sampleMap.json relative to where you are serving from, and that the subfolder samples contains all the samples.
