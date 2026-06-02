// jest runs this before test modules are loaded.
// babel-preset-expo (when using the metro caller) replaces process.env.NODE_ENV
// with 'production' inside transformed files, which causes React to load its
// production build and breaks act(). Reset it to 'test' here so React picks
// the development build when it is first required by the test suite.
process.env.NODE_ENV = 'test';
