module.exports = function( grunt ) {
  grunt.initConfig({
    pkg: grunt.file.readJSON( "package.json" ),
    jshint: {
      options: {
        "-W054": true,  // The Function constructor is a form of eval
      },
      files: [
        "Gruntfile.js",
        "*.js",
      ]
    }
  });

  grunt.loadNpmTasks( "grunt-contrib-jshint" );
  grunt.registerTask( "default", [ "jshint" ]);
};
