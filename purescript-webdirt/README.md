# purescript-webdirt

WebDirt as a PureScript library

Some rough notes on how to integrate this...


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


```
<html>
<body onload="wd=PS['Main'].launch()">
 <script src="./WebDirt-packed.js"></script>
 <script src="./index.js"></script>
 <button onclick="PS['Main'].makeASound(wd)()">Press Me</button>
</body>
</html>
```
