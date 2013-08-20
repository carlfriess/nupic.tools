// MAIN PROGRAM, start here.

// global libs
var assert = require('assert'),
    fs = require('fs'),
    connect = require('connect'),
    colors = require('colors'),
    // local libs
    utils = require('./utils/general'),
    githubHookHandler = require('./githubHook'),
    // The configReader reads the given file, and merges it with any existing user
    // configuration file.
    cfg = require('./utils/configReader').read('./conf/config.json'),

    HOST = cfg.host,
    PORT = cfg.port || 8081,

    baseUrl = 'http://' + HOST + ':' + PORT,
    // This path is registered with Github as a webhook URL.
    githubHookPath = '/github-hook',
    prWebhookUrl = baseUrl + githubHookPath,

    // This directory contains all the additional service
    // handlers that will be loaded dynamically and attached
    // to this web server.
    HANDLER_DIR = './handlers';

console.log('nupic.tools server starting...'.green);
console.log('nupic.tools will use the following configuration:');
console.log(JSON.stringify(utils.sterilizeConfig(cfg), null, 2).yellow);

utils.constructRepoClients(prWebhookUrl, cfg, function(repoClients) {
    var dynamicHttpHandlerModules,
        // The Connect JS application
        app = connect();

    // Enable a log of logging.
    app.use(connect.logger('dev'))
       // Auto body parsing is nice.
       .use(connect.bodyParser())
       // This puts the Github webhook handler into place
       .use(githubHookPath, githubHookHandler(repoClients));

    dynamicHttpHandlerModules = utils.initializeModulesWithin(HANDLER_DIR);

    // Loads all the modules within the handlers directory, and registers the URLs
    // the declared, linked to their request handler functions.
    dynamicHttpHandlerModules.forEach(function(handlerConfig) {
        var urls = Object.keys(handlerConfig);
        urls.forEach(function(url) {
            var handler = handlerConfig[url](repoClients, dynamicHttpHandlerModules, cfg),
                name = handler.title,
                desc = handler.description,
                msg = '==> ' + name + ' listening for url pattern: ' + url;
            if (! handler.disabled) {
                console.log(msg.cyan);
                app.use(url, handler);
            }
        });
    });
        
    app.listen(PORT, function() {
        console.log(('\nServer running at ' + baseUrl + '\n').green);
    });

});
