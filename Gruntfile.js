module.exports = function(grunt) {

  function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  var core = [
    'src/core/lib/web-components-polyfill.js',
    'src/core/src/core.js'
    ],
    mixins = [

    ],
    elements = [
      'src/accordion/src/accordion.css',
      'src/accordion/src/accordion.js'
    ],
    themes = [

    ];

  var all = [].concat(core,mixins,elements);
    alljs = all.filter(function(file){ return endsWith(file,'js') }),
    allcss = all.filter(function(file){ return endsWith(file,'css') });

  // Project configuration.
  grunt.initConfig({
    concat:{
      js: {
        src: alljs,
        dest: 'dist/x-tag-components.js'
      },
      css: {
        src: allcss,
        dest: 'dist/x-tag-components.css'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-connect');

  grunt.registerTask('build', ['concat']);

};
