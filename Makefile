build:
	npx webpack
	cp -f js-src/AudioWorklets.js dist/AudioWorklet.js
