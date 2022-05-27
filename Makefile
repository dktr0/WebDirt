build:
	npx webpack
	cp -f src/AudioWorklets.js dist/AudioWorklet.js
