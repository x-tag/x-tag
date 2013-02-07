module.exports = function (grunt) {
  'use strict';

  // Project configuration.
  grunt.initConfig({    
    concat: {
      all:{
        src:[
          'components/document.register/src/document.register.js',
          'components/x-tag-core/src/core.js'
        ],
        dest: 'dist/x-tag-core.js'
      }
    },
    uglify: {
      all: {
        files :{
          'dist/x-tag-core.min.js': ['dist/x-tag-core.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  
  // Default task.
  grunt.registerTask('default', ['build']);
  grunt.registerTask('build', ['concat','uglify']);

};
