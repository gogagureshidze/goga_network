const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute actual server-action code with isolated service boundaries. No database,
// credentials, Clerk session, or network is touched by these regression tests.
module.exports = function loadTs(file, mocks = {}, globals = {}, cache = new Map()) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const output = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: absolute,
  }).outputText;
  vm.runInNewContext(output, {
    exports,
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("@/")) return module.exports(path.resolve("src", id.slice(2)) + ".ts", mocks, globals, cache);
      throw new Error(`Unmocked dependency: ${id}`);
    },
    console: { log() {}, error() {} },
    process: { env: {} },
    URL, Buffer, AbortSignal, Response, Request,
    ...globals,
  }, { filename: absolute });
  return exports;
};
