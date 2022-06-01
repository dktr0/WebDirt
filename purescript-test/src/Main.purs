module Main where

import Prelude

import Effect (Effect)
import Effect.Console (log)
import WebDirt

launch :: Effect WebDirt
launch = do
  wd <- newWebDirt { sampleMapUrl: "samples/sampleMap.json", sampleFolder: "samples" }
  initializeWebAudio wd
  pure wd

makeSound0 :: WebDirt -> Effect Unit
makeSound0 wd = playSample wd { s: "arpy", note: 0}

makeSound4 :: WebDirt -> Effect Unit
makeSound4 wd = playSample wd { s: "arpy", note: 4}

makeSound7 :: WebDirt -> Effect Unit
makeSound7 wd = playSample wd { s: "arpy", note: 7}

makeSoundBackwards :: WebDirt -> Effect Unit
makeSoundBackwards wd = playSample wd { s: "arpy", note: 0, speed: -1 }
