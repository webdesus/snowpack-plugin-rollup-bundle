'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var rollup = _interopDefault(require('rollup'));
var fs = _interopDefault(require('fs-extra'));
var path = _interopDefault(require('path'));
var glob = _interopDefault(require('glob'));
var os = _interopDefault(require('os'));
var resolve = _interopDefault(require('@rollup/plugin-node-resolve'));
var commonjs = _interopDefault(require('@rollup/plugin-commonjs'));
var styles = _interopDefault(require('rollup-plugin-styles'));
var rollupPluginTerser = require('rollup-plugin-terser');
var url = _interopDefault(require('@rollup/plugin-url'));
var sourcemaps = _interopDefault(require('rollup-plugin-sourcemaps'));
require('child_process');
var fs$1 = _interopDefault(require('fs'));
var jsdom = require('jsdom');

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function defaultInputOptions({
  buildDirectory,
  tmpDir,
  sourcemap
}) {
  const plugins = [resolve({
    browser: true
  }), styles({
    mode: ["extract", "app.css"],
    autoModules: id => id.includes(".module.css"),
    minimize: true,
    sourceMap: sourcemap
  }), url({
    include: "**/*",
    exclude: "**/*.(js|json|css)",
    destDir: path.resolve(tmpDir),
    sourceDir: path.resolve(buildDirectory),
    limit: 0,
    // extract all files
    fileName: "[dirname]/[name]-[hash][extname]"
  }), commonjs()];

  if (sourcemap) {
    plugins.push(sourcemaps());
  }

  return {
    plugins
  };
}
function defaultOutputOptions(buildDirectory) {
  return {
    format: "es",
    plugins: [rollupPluginTerser.terser()],
    manualChunks: id => {
      if (id.includes("web_modules")) {
        return path.parse(id).name;
      }
    },
    assetFileNames: "css/[name]-[hash].[ext]",
    chunkFileNames: "chunks/[name]-[hash].chunk.js",
    compact: true,
    sourcemap: true,
    entryFileNames: "[name]-[hash].js",
    dir: buildDirectory
  };
}

// https://github.com/pikapkg/snowpack/blob/master/plugins/plugin-webpack/plugins/proxy-import-resolve.js
function proxyImportResolver(source) {
  const regex = /import.*['"].*\.(\w+)\.proxy\.js['"]/g;
  return source.replace(regex, (fullMatch, originalExt) => {
    // no JSON plugin loaded
    if (originalExt === "json") {
      return fullMatch;
    }

    return fullMatch.replace(".proxy.js", "");
  });
}

/**
 * Normalizes \\ on windows to /
 * @param {string} filePath - Normalizes \ to / on windows.
 */

function pathToUnix(filePath) {
  if (path.sep === "\\") {
    return filePath.replace(/\\/g, "/");
  }

  return filePath;
}
function parseHashFileName(filePath) {
  const {
    dir,
    base
  } = path.parse(filePath);
  const fileWithoutHash = base.replace(/(.*)-\w+(\.\w+)/g, "$1$2");
  return pathToUnix(path.join(dir, fileWithoutHash));
}
function prependSlash(fileName) {
  if (fileName[0] === "/") {
    return fileName;
  }

  return "/" + fileName;
}

function addToManifest({
  manifest,
  chunkOrAsset,
  assignTo,
  useFileType = true
}) {
  const {
    fileName
  } = chunkOrAsset;
  const asset = chunkOrAsset;
  const assignment = assignTo;
  manifest[parseHashFileName(fileName)] = prependSlash(fileName);
  manifest[assignment] = manifest[assignment] || {};
  assignAsset({
    obj: manifest[assignment],
    asset,
    useFileType
  });
}

function assignAsset({
  obj,
  asset,
  useFileType
}) {
  const {
    map,
    fileName
  } = asset;
  let fileType = extType(fileName);
  let baseName;
  baseName = parseHashFileName(fileName);

  if (baseName === undefined) {
    return;
  } // js / js.map / css / css.map files do not use an extension.


  if (fileType !== null) {
    // Split at the first . just in case it has multiple extensions IE: .css.map
    let {
      dir,
      name
    } = path.parse(baseName);

    if (fileType.startsWith("css")) {
      dir = dir.split("/").slice(2).join("");
    } else if (fileType.startsWith("js")) {
      dir = dir.split("/").slice(1).join("");
    }

    baseName = pathToUnix(path.join(dir, name.split(".")[0]));
  }

  const adjustedFileName = prependSlash(fileName);
  obj[baseName] = obj[baseName] || {};

  if (useFileType === false) {
    obj[baseName] = adjustedFileName;
    return;
  }

  obj[baseName][fileType] = adjustedFileName;

  if (map) {
    const mapFile = adjustedFileName + ".map";
    fileType = extType(mapFile);
    obj[baseName][fileType] = mapFile;
  }
}

function extType(fileName) {
  if (fileName.endsWith(".css.map")) {
    return "css.map";
  } else if (fileName.endsWith(".css")) {
    return "css";
  } else if (fileName.endsWith(".js.map")) {
    return "js.map";
  } else if (fileName.endsWith(".js")) {
    return "js";
  }

  return null;
}

/**
 * An instance of JSDOM
 * @typedef {string} JSDOM
 */

/**
 * A manifest file parsed to an Object
 * @typedef {Object} ManifestObject
 */

/**
 * Rewrites the values of scripts and extrapolates the css file
 *   associated with the script.
 *
 * @param {Object} params
 * @param {string} params.file - Path to a file
 * @param {ManifestObject} params.manifest - Manifest Object
 * @param {string} params.destFile - Path to the new file
 * @returns {undefined}
 */

function emitHtmlFiles({
  file,
  manifest,
  destFile,
  baseUrl
}) {
  const fileContents = fs$1.readFileSync(file, {
    encoding: "utf8"
  });
  const dom = new jsdom.JSDOM(fileContents, {
    includeNodeLocations: true
  });
  const newDom = rewriteScripts({
    dom,
    manifest,
    baseUrl
  });
  fs$1.writeFileSync(destFile, newDom.serialize(), "utf8");
}
/**
 * Rewrites the scripts of a given JSDOM instance to use files from the manifest
 * @param {Object} params
 * @param {JSDOM} params.dom - An instance of JSDOM
 * @param {ManifestObject} params.manifest - Manifest file parsed to Object
 * @returns {string} Returns a string from serializing JSDOM
 */

function rewriteScripts({
  dom,
  manifest,
  baseUrl
}) {
  const domDocument = dom.window.document;
  const scripts = domDocument.querySelectorAll("script");
  const unhashedEntrypoints = Object.keys(manifest.entrypoints).map(fileName => {
    return parseHashFileName(manifest.entrypoints[fileName]["js"]);
  });
  scripts.forEach(script => {
    if (!isEntrypoint({
      entrypoints: unhashedEntrypoints,
      script
    })) {
      return;
    }

    const baseFile = path.parse(script.src).name;
    const jsFile = manifest.entrypoints[baseFile].js;
    script.src = fixUrl({
      baseUrl,
      file: jsFile
    });
    const cssFile = manifest.entrypoints[baseFile].css;

    if (cssFile == undefined) {
      return;
    }

    const stylesheet = domDocument.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = fixUrl({
      baseUrl,
      file: cssFile
    });
    insertBefore(script, stylesheet);
  });
  return dom;
}

function fixUrl({
  baseUrl,
  file
}) {
  return prependSlash(pathToUnix(path.join(baseUrl, file)));
}

function insertBefore(existingNode, newNode) {
  existingNode.parentNode.insertBefore(newNode, existingNode);
}

function isEntrypoint({
  entrypoints,
  script
}) {
  // Remove trailing slashes
  script.src.replace(/\/$/, "");

  if (entrypoints.includes(script.src)) {
    return true;
  } // Account for src="entrypoints/blah"


  if (entrypoints.includes("/" + script.src)) {
    script.src = "/" + script.src;
    return true;
  }

  return false;
}

const TMP_BUILD_DIRECTORY = path.join(os.tmpdir(), "build");

function getEntrypoints({
  entrypoints,
  buildDirectory
}) {
  if (typeof entrypoints === "string") {
    const obj = {};
    glob.sync(entrypoints).forEach(file => {
      const {
        dir,
        name
      } = path.parse(file); // This fixes issues that were causing x.js-[hash].js

      const fileWithoutExt = path.join(dir, name);
      const buildFile = pathToUnix(path.relative(buildDirectory, fileWithoutExt));
      obj[buildFile] = file;
    });
    return obj;
  }

  return entrypoints;
}

async function rollupBuild({
  snowpackConfig,
  pluginOptions,
  inputOptions,
  outputOptions
}) {
  const baseUrl = snowpackConfig.devOptions.baseUrl || "/";
  const TMP_DEBUG_DIRECTORY = path.join(os.tmpdir(), "_source_");
  const buildDirectory = outputOptions.dir;
  outputOptions.dir = TMP_BUILD_DIRECTORY;
  const entrypoints = getEntrypoints({
    entrypoints: pluginOptions.entrypoints,
    buildDirectory
  });
  inputOptions.input = inputOptions.input || entrypoints;
  const bundle = await rollup.rollup(inputOptions);
  const {
    output
  } = await bundle.generate(outputOptions);
  const manifest = {};

  for (const chunkOrAsset of output) {
    if (chunkOrAsset.isEntry || chunkOrAsset.type === "asset") {
      addToManifest({
        manifest,
        chunkOrAsset,
        assignTo: "entrypoints"
      });
      continue;
    }

    addToManifest({
      manifest,
      chunkOrAsset,
      assignTo: "chunks"
    });
  }

  await bundle.write(outputOptions); // Add assets to manifest, use path.relative to fix minor issues

  glob.sync(`${TMP_BUILD_DIRECTORY}/**/*.*`).forEach(fileName => {
    fileName = pathToUnix(path.relative(TMP_BUILD_DIRECTORY, fileName));
    const chunkOrAsset = {
      fileName,
      map: null
    };
    addToManifest({
      manifest,
      chunkOrAsset,
      assignTo: "assets",
      useFileType: false
    });
  });
  const manifestJSON = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(TMP_BUILD_DIRECTORY, "manifest.json"), manifestJSON); // HTML files will not be pulled in by rollup, its up to us
  // to manually pull them in.

  if (pluginOptions.emitHtmlFiles === true) {
    glob.sync(buildDirectory + "/**/*.html").forEach(file => {
      let destFile = path.relative(buildDirectory, file);
      destFile = path.resolve(TMP_BUILD_DIRECTORY, destFile);
      const destDir = path.parse(destFile).dir;

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, {
          recursive: true
        });
      }

      emitHtmlFiles({
        file,
        manifest,
        destFile,
        baseUrl
      });
    });
  }

  await fs.remove(TMP_DEBUG_DIRECTORY);
  await fs.mkdirp(TMP_DEBUG_DIRECTORY);
  await fs.move(buildDirectory, TMP_DEBUG_DIRECTORY, {
    overwrite: true
  });
  await fs.move(TMP_BUILD_DIRECTORY, buildDirectory, {
    overwrite: true
  });

  if (pluginOptions.preserveSourceFiles === true) {
    const buildDebugDir = path.join(buildDirectory, "_source_");
    await fs.move(TMP_DEBUG_DIRECTORY + "/", buildDebugDir, {
      overwrite: true
    });
  }
}

const plugin = (snowpackConfig, pluginOptions = {}) => {
  snowpackConfig.buildOptions.minify = false; // Let rollup handle this

  snowpackConfig.buildOptions.clean = true;
  return {
    name: "snowpack-plugin-rollup-bundle",

    async optimize({
      buildDirectory
    }) {
      const inputOptions = defaultInputOptions({
        buildDirectory,
        tmpDir: TMP_BUILD_DIRECTORY,
        sourcemap: snowpackConfig.buildOptions.sourcemap
      });
      const outputOptions = defaultOutputOptions(buildDirectory);

      let extendConfig = cfg => cfg;

      if (typeof pluginOptions.extendConfig === "function") {
        extendConfig = pluginOptions.extendConfig;
      } else if (typeof pluginOptions.extendConfig === "object") {
        extendConfig = cfg => _objectSpread2(_objectSpread2({}, cfg), pluginOptions.extendConfig);
      }

      const extendedConfig = await extendConfig({
        snowpackConfig: _objectSpread2({}, snowpackConfig),
        pluginOptions: _objectSpread2({}, pluginOptions),
        inputOptions: _objectSpread2({}, inputOptions),
        outputOptions: _objectSpread2({}, outputOptions)
      }); // Rewrite "proxy.js" imports prior to building

      glob.sync(buildDirectory + "/**/*.js", {
        nodir: true
      }).forEach(file => {
        const resolvedImports = proxyImportResolver(fs.readFileSync(file, "utf8"));
        fs.writeFileSync(file, resolvedImports, "utf8");
      });
      await rollupBuild(extendedConfig);
    }

  };
};

exports.default = plugin;
//# sourceMappingURL=index.js.map
