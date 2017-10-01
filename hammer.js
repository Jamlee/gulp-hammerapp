var through = require('through2');
var rs = require('replacestream');

var fs = require('fs');
var path = require('path');
var isGlob = require('is-glob');
var resolveDir = require('resolve-dir');
var detect = require('detect-file');
var mm = require('micromatch');
var sprintf = require('sprintf')

////////////////////////////////////////////////////////////////////
// local file finding
// 
// thanks for `find-up` 
////////////////////////////////////////////////////////////////////
function findCurrentDirAllFileFactory() {
  var cachedFileTree = {};

  // finding file rescursively
  function findupSync(patterns, options) {

    // get all file that match the one of the patterns (string patch or regex pattern)
    function lookup(cwd, patterns, options) {
      var len = patterns.length;
      var idx = -1;
      var res;

      while (++idx < len) {
        if (isGlob(patterns[idx])) {
          res = matchFile(cwd, patterns[idx], options);
        } else {
          res = findFile(cwd, patterns[idx], options);
        }
        if (res) {
          return res;
        }
      }
      return null;
    }

    options = options || {};
    var cwd = path.resolve(resolveDir(options.cwd || ''));

    if (typeof patterns === 'string') {
      return lookup(cwd, [patterns], options);
    }

    if (!Array.isArray(patterns)) {
      throw new TypeError('findup-sync expects a string or array as the first argument.');
    }

    return lookup(cwd, patterns, options);
  };

  // get the file path matching regex 
  // TODO exclude some dir
  function matchFile(cwd, pattern, opts) {
    // flat the dir files path
    function tryReaddirSync(dir, currentPath = '') {
      if (dir == '') {
        return [];
      }
      var results = [];
      var list = fs.readdirSync(path.join(dir, currentPath));
      list.forEach(function (file) {
        var tryDir = path.join(dir, currentPath, file);
        var stat = fs.statSync(tryDir)
        var newPath = path.join(currentPath, file);

        if (stat && stat.isDirectory() && file !== 'node_modules') {
          results = results.concat(tryReaddirSync(dir, newPath));
        } else results.push(newPath)
      });
      return results
    }

    var isMatch = mm.matcher(pattern, opts);

    var files = null;
    if (cachedFileTree[cwd] !== undefined) {
      files = cachedFileTree[cwd];
    } else {
      files = tryReaddirSync(cwd);
      cachedFileTree[cwd] = files;
    }

    var len = files.length;
    var idx = -1;

    while (++idx < len) {
      var name = files[idx];
      var fp = path.join(cwd, name);
      if (isMatch(name) || isMatch(fp)) {
        return fp;
      }
    }
    return null;
  }

  // find file path 
  function findFile(cwd, filename, options) {
    var fp = cwd ? path.resolve(cwd, filename) : filename;
    return detect(fp, options);
  }

  return findupSync;
}


////////////////////////////////////////////////////////////////////
// glup pulgin
////////////////////////////////////////////////////////////////////
function replacer(search, _replacement, options) {
  // the plugin definition of the gulp defined
  var stream = through.obj(function (file, enc, cb) {

    if (file.isNull()) {
      this.push(file);
      return cb();
    }

    var replacement = {};
    if (typeof _replacement === 'function') {
      // Pass the vinyl file object as this.file
      replacement = _replacement.bind({
        file: file,
        opt: options,
      });
    }

    // Stream 与 Buffer 两种模式, 现在测试时得到时Buffer模式
    if (file.isStream()) {
      file.contents = file.contents.pipe(rs(search, _replacement));
      return cb();
    }

    if (file.isBuffer()) {
      if (search instanceof RegExp) {
        file.contents = new Buffer(String(file.contents).replace(search, replacement));
      } else {
        var chunks = String(file.contents).split(search);
        var result;

        if (typeof replacement === 'function') {
          // Start with the first chunk already in the result
          // Replacements will be added thereafter
          // This is done to avoid checking the value of i in the loop
          result = [chunks[0]];
          // The replacement function should be called once for each match
          for (var i = 1; i < chunks.length; i++) {
            // Add the replacement value
            result.push(replacement(search));
            // Add the next chunk
            result.push(chunks[i]);
          }
          result = result.join('');
        } else {
          result = chunks.join(replacement);
        }

        file.contents = new Buffer(result);
      }
    }

    this.push(file);
    cb();
  });

  return stream;
};


////////////////////////////////////////////////////////////////////
// stragey function, for handling tag
////////////////////////////////////////////////////////////////////

// the core of the handle
// for example
// `include` handle by `include_tag` function
function handler(match, key, value) {
  try {
    var callable = key.slice(1) + '_tag';
    return eval(callable).call(this, value);
  } catch (e) {
    throw Error(callable + '()' + ' method called error');
  }
}


function path_tag(value) {
  var findupSync = findCurrentDirAllFileFactory();
  var searched_dir = this.opt.cwd;
  var found_file = ['**/' + value];
  var target = findupSync(found_file, {
    cwd: searched_dir,
    exclude: ['dist/']
  });
  return target.replace(searched_dir, '');
}

function include_tag(value) {
  var findupSync = findCurrentDirAllFileFactory();
  var searched_dir = this.opt.cwd;
  var found_file = '**/' + value + '.html';
  var target = findupSync(found_file, {
    cwd: searched_dir
  });

  if (target === null) {
    var err = new Error('the file: ' + found_file + ' is not found');
    throw err
  }
  return fs.readFileSync(target);
}

function stylesheet_tag(value) {
  var findupSync = findCurrentDirAllFileFactory();
  var list = value.split(/\s+/);
  var result = '';
  var searched_dir = this.opt.cwd;
  var cssDir = this.opt.cssDir;

  list.forEach(function (resource) {  
    // app.css?v=1 else app.css
    if (resource.indexOf('?') !== -1) {
      var arr = resource.split('?');
      var found_file = '**/' + arr[0] + '.css';
      var target = findupSync(found_file, {
        cwd: searched_dir
      });
      if (target === null) {
        var err = new Error('the file: ' + found_file + ' is not found');
        throw err
      }
      linkTag = sprintf('<link rel="stylesheet" href="%(dir)s%(relativePath)s" />', {
        dir: cssDir,
        relativePath:  target.replace(searched_dir, '') + '?' + arr[1]
      });
      result += linkTag;
    } else {
      var found_file = '**/' + resource + '.css';
      var target = findupSync(found_file, {
        cwd: searched_dir
      });
      if (target === null) {
        var err = new Error('the file: ' + found_file + ' is not found');
        throw err;
      }
      linkTag = sprintf('<link rel="stylesheet" href="%(dir)s%(relativePath)s" />', {
        dir: cssDir,
        relativePath:  target.replace(searched_dir, '')
      });
      result += linkTag;
    }
  });

  return result;
}

function javascript_tag(value) {
  var findupSync = findCurrentDirAllFileFactory();
  var list = value.split(/\s+/);
  var result = '';
  var searched_dir = this.opt.cwd;
  var jsDir = this.opt.jsDir;
  list.forEach(function (resource) {
    var found_file = '**/' + resource + '.js';
    var target = findupSync(found_file, {
      cwd: searched_dir
    });
    if (target === null) {
      var err = new Error('the file: ' + found_file + ' is not found');
      throw err
    }
    scriptTag = sprintf('<script type="text/javascript" src="%(dir)s%(relativePath)s" ></script>', {
        dir: jsDir,
        relativePath:  target.replace(searched_dir, '')
      });
    result += scriptTag;
  });
  return result;
}

// TODO unimplement
function placeholder_tag() {
  return 'placeholder';
}


////////////////////////////////////////////////////////////////////
// Entry
// 
// opt is :
// { 
//   cwd: __dirname,
//   exclude: ['dist/']
// }
////////////////////////////////////////////////////////////////////
module.exports = {
  tag_path: function (opt) {
    return replacer(/\<!--\s+?(@path)\s+?(.*?)\s+?--\>/mg, handler, opt)
  },
  tag_include: function (opt) {
    return replacer(/\<!--\s+?(@include)\s+?(.*?)\s+?--\>/mg, handler, opt)
  },
  tag_stylesheet: function (opt) {
    return replacer(/\<!--\s+?(@stylesheet)\s+?(.*?)\s+?--\>/mg, handler, opt)
  },
  tag_javascript: function (opt) {
    return replacer(/\<!--\s+?(@javascript)\s+?(.*?)\s+?--\>/mg, handler, opt)
  },
  tag_placeholder: function (opt) {
    return replacer(/\<!--\s+?(@placeholder)\s+?(.*?)\s+?--\>/mg, handler, opt)
  }
}