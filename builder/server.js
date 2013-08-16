#!/usr/bin/env node
/*jshint node: true */
var express = require('express'),
    path = require('path'),
    extractAssets = require('./extractAssets'),

    fs = require('fs'),
    fsextra = require('fs-extra'),
    q = require('q'),
    readFile = q.denodeify(fs.readFile),
    writeFile = q.denodeify(fs.writeFile),
    mkdirs = q.denodeify(fsextra.mkdirs),
    copy = q.denodeify(fsextra.copy),
    createFile = q.denodeify(fsextra.createFile),

    manifestTemplate = fs.readFileSync(path.join(__dirname, 'template.webapp')),

    seedName = new Date().getTime(),
    counter = 1;

// Turn on q's long stack trace for dev, but turn off before shipping:
// https://github.com/kriskowal/q#long-stack-traces
q.longStackSupport = true;

var app = express();

app.use(express.bodyParser({ keepExtensions: true }));

// Maybe you do not want this for the final builder. Would allow any random
// posts.
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.post('/api/makezip', function(req, res) {

  var results,
      indexData = req.files.index,
      dirName = 'app' + seedName + '-' + (counter += 1),
      fullDirName = path.join(__dirname, 'output', dirName),
      assetsDirName = path.join(fullDirName, 'appmaker-components', 'assets');

  function cleanup() {
    // Delete the uploaded file
    // Ignoring return on this call.
    fs.unlink(indexData.path);
  }

  readFile(indexData.path, 'utf8').then(function(text) {
    // Find all components used in the page
    return extractAssets(__dirname, text);
  }).then(function(r) {
    // Make output directory
    results = r;
    return mkdirs(fullDirName);
  }).then(function() {
    return mkdirs(assetsDirName);
  }).then(function() {
    // Copy over assets. A TODO would be to trim this based on what is
    // referenced by HTML/CSS/JS files.
    return copy(path.join(__dirname, 'appmaker-components', 'assets'),
                assetsDirName);
  }).then(function() {
    // Write out all the files collected during extraction.
    var filePromises = Object.keys(results.pathContentMap).map(function(p) {
      var filePath = path.join(fullDirName, p);
      return createFile(filePath).then(function() {
        return writeFile(filePath, results.pathContentMap[p], 'utf8');
      });
    });
    return q.all(filePromises);
  }).then(function() {
    // Copy over the style files.
    return copy(path.join(__dirname, 'style'),
                path.join(fullDirName, 'style'));
  }).then(function() {
    return mkdirs(path.join(fullDirName, 'scripts'));
  }).then(function() {
    // Copy over the script files.
    var paths = [
      [
        __dirname + '/scripts/require.min.js',
        fullDirName + '/scripts/require.min.js'
      ],
      [
        __dirname + '/../ceci.js',
        fullDirName + '/scripts/ceci.js'
      ],
      [
        __dirname + '/../ceci-ui.js',
        fullDirName + '/scripts/ceci-ui.js'
      ]
    ];

    var filePromises = paths.map(function(entry) {
      return copy(entry[0], entry[1]);
    });

    return q.all(filePromises);
  }).then(function() {
    // Create manifest.
    var manifest = JSON.parse(manifestTemplate);

    // TODO in future, do custom things like create a unique name.

    // Save manifest.
    var manifestPath = path.join(fullDirName, 'manifest.webapp');
    return createFile(manifestPath).then(function() {
      return writeFile(manifestPath,
                       JSON.stringify(manifest, null, '  '), 'utf8');
    });
  }).then(function() {
    // zip

  }).then(function() {
    // send the file back

    res.send('Directory generated at: output/' + dirName);
  }).then(cleanup, function(err) {
    cleanup();
    console.log('ERROR generating zip: ' + err);
    console.log(err.stack);
    res.send(500, { error: err });
  });
});

var server = app.listen(process.env.PORT || 8321, function (err) {
  console.log('Running on', server.address());
});
