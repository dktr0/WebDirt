module WebDirt (
  Options,
  WebDirt,
  newWebDirt,
  initializeWebAudio,
  Parameters,
  playSample,
  sampleHint
  ) where

import Prelude (Unit)
import Effect (Effect)
import Option as Option
import Foreign
import Simple.JSON as JSON

type Options = Option.Record () (
  sampleMapUrl :: String, -- URL to old-style sample map, if not given WebDirt assumes caller will provide buffers
  sampleFolder :: String, -- URL to where samples are located if WebDirt has an old-style sample map (default: 'samples')
  -- readyCallback ... TODO: currently not implemented in PureScript binding
  latency :: Number, -- time in seconds by which to delay sample onset, default is 0.4
  maxLateness :: Number,
  audioContext :: Foreign, -- way of providing an existing Web Audio API context for WebDirt to use
  destination :: Foreign -- way of providing an existing Web Audio API node to which WebDirt will direct output
  )

foreign import data WebDirt :: Type

newWebDirt :: Options -> Effect WebDirt
newWebDirt os = _newWebDirt (JSON.write os)

foreign import _newWebDirt :: Foreign -> Effect WebDirt

foreign import initializeWebAudio :: WebDirt -> Effect Unit

type Parameters = Option.Record () (
  buffer :: Foreign, -- Web Audio buffer of sample data to play (ie. new-style)
  s :: String, -- name of sample bank (ie. old-style with sampleMap)
  n :: Int, -- number of sample within a bank (ie. old-style with sampleMap)
  whenPosix :: Number, -- when to play the sample, in POSIX/epoch-1970 time
  when :: Number, -- when to play the sample, in audio context time
  gain :: Number, -- clamped from 0 to 2; 1 is default and full-scale
  overgain :: Number, -- additional gain added to gain to go past clamp at 2
  pan :: Number, -- range: 0 to 1
  nudge :: Number, -- nudge the time of the sample forwards/backwards in seconds
  speed :: Number,
  note :: Number,
  begin :: Number,
  end :: Number,
  cut :: Int,
  shape :: Number,
  cutoff :: Number,
  resonance :: Number,
  hcutoff :: Number,
  hresonance :: Number,
  bandf :: Number,
  bandq :: Number,
  vowel :: String,
  delay :: Number,
  delaytime :: Number,
  delayfeedback :: Number,
  loop :: Number,
  crush :: Number,
  coarse :: Number,
  unit :: String
  )

playSample :: WebDirt -> Parameters -> Effect Unit
playSample wd ps = _playSample wd (JSON.write ps)

foreign import _playSample :: WebDirt -> Foreign -> Effect Unit

foreign import sampleHint :: WebDirt -> String -> Effect Unit
