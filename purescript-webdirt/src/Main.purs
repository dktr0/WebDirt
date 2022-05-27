module Main where

import Prelude
import Effect (Effect)
import WebDirt
import Option (fromRecord')

main :: Effect Unit
main = pure unit

launch :: Effect WebDirt
launch = do
  wd <- newWebDirt $ fromRecord' { sampleMapUrl: "samples/sampleMap.json", sampleFolder: "samples" }
  initializeWebAudio wd
  pure wd

makeASound :: WebDirt -> Effect Unit
makeASound wd = playSample wd $ fromRecord' { s: "gtr" }
