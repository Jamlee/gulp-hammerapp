## gulp-hammerapp

what it is:

- engine for template engine
- complier for hammerappformac

## Usage

````
 gulp.src('./**/*.html')
    .pipe(gulpIgnore.exclude('node_modules/**'))
    .pipe(gulpIgnore.exclude('dist/**'))
    .pipe(replace.tag_include())
    .pipe(replace.tag_javascript())
    .pipe(replace.tag_stylesheet())
    .pipe(replace.tag_placeholder())
    .pipe(replace.tag_path())
    .pipe(gulpIgnore.exclude('includes/**'))
    .pipe(htmlbeautify(options))
    .pipe(gulp.dest('dist'));
    
````