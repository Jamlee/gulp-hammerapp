var hammer = require('./hammer');
var util = require('gulp-util');
var path = require('path');
var File = util.File;

function makeTestFile(path, contents) {
  contents = contents || 'test file';
  return new File({
    path: path,
    contents: new Buffer(contents)
  });
}

test('test @path, execpt it can found png or other assest automatically', () => {

  var stream = hammer.tag_path({cwd: path.join(__dirname, 'test')}),
      file = makeTestFile('./test/index.html', '<!-- @path test.png -->');

  stream.on('data', function (file) {
    expect(file.path).toBe('./test/index.html');
    expect(String(file.contents)).toBe('/test.png');
  });

  stream.write(file);
  stream.end();
});

test('test @include, execpt it can include other html automatically', () => {

  var stream = hammer.tag_include({cwd: path.join(__dirname, 'test/includes')}),
      file = makeTestFile('./test/index.html', 'xxx <!-- @include _partial --> xxx');

  stream.on('data', function (file) {
    expect(file.path).toBe('./test/index.html');
    expect(String(file.contents)).toBe('xxx from _partial xxx');
  });
  
  stream.write(file);
  stream.end();
});

test('test @tag_stylesheet, execpt it can include other css automatically', () => {

  var stream = hammer.tag_stylesheet({cwd: path.join(__dirname, 'test/dist'), cssDir: '/assets'}),
      file = makeTestFile('./test/index.html', '<!-- @stylesheet fake fake -->');

  stream.on('data', function (file) {
    expect(file.path).toBe('./test/index.html');
    expect(String(file.contents)).toBe(String('<link rel="stylesheet" href="/assets/fake.css" /><link rel="stylesheet" href="/assets/fake.css" />'));
  });
  
  stream.write(file);
  stream.end();
});

test('test @tag_javascript, execpt it can include other js automatically', () => {

  var stream = hammer.tag_javascript({cwd: path.join(__dirname, 'test/dist'), jsDir: '/assets'}),
      file = makeTestFile('./test/index.html', '<!-- @javascript fake -->');

  stream.on('data', function (file) {
    expect(file.path).toBe('./test/index.html');
    expect(String(file.contents)).toBe(String('<script type="text/javascript" src="/assets/fake.js" ></script>'));
  });

  stream.write(file);
  stream.end();
});