var assert = require('assert'),
    connect = require('connect'),
    colors = require('colors'),
    
    RepositoryClient = require('./repoClient'),
    contributors = require('./contributors'),
    githubHookHandler = require('./githubHook'),
    statusReporter = require('./statusReporter'),
    pullRequestReporter = require('./pullRequestReporter'),
    cfg = require('./configReader').read(),

    HOST = cfg.host,
    PORT = cfg.port || 8081,

    baseUrl = 'http://' + HOST + ':' + PORT,
    githubHookPath = '/github-hook',
    statusReportPath = '/shaStatus',
    pullRequestReportPath = '/prStatus',
    pullRequestWebhookUrl = baseUrl + githubHookPath,

    githubClients = {},

    channelName = 'nupic';

function die(err) {
    console.error(err);
    process.exit(-1);
}

function resolveConfig(config) {
    var cfgCopy = $.extend(true, {}, config),
        monitor = cfgCopy.monitor;

    assert(config.monitor);
    assert(config.monitor.length, 'The "monitor" configuration must be an array, and cannot be empty.');

    monitor.forEach(function(m, i) {
        // Verify values.
        assert(monitor[i].username, 'monitor at ' + i + ' missing username');
        assert(monitor[i].password, 'monitor at ' + i + ' missing password');
        assert(monitor[i].organization, 'monitor at ' + i + ' missing organization');
        assert(monitor[i].repository, 'monitor at ' + i + ' missing repository');
        // Obscure passwords.
        cfgCopy.monitor[i].password = '<hidden>';
    });
    console.log('nupic.tools will use the following configuration:');
    console.log(JSON.stringify(cfgCopy, null, 2).yellow);

}

function establishWebHooks(config, callback) {
    var count = 0;
    // Set up one github client for each repo target in config.
    config.monitor.forEach(function(repoTarget) {
        var githubClient = new RepositoryClient(repoTarget);

        githubClient.confirmWebhookExists(pullRequestWebhookUrl, 'pull_request', function(err) {
            if (err) {
                console.error(('Error during webhook confirmation for ' + githubClient.toString()).red);
                die(err);
            } else {
                console.log(('Webhook for ' + githubClient.toString() + ' confirmed.').green);
                count++;
            }
            githubClients[repoTarget.organization + '/' + repoTarget.repository] = githubClient;
            if (count == (config.monitor.length ))  {
                callback();
            }
        });
    });
}

console.log('nupic.tools server starting...'.green);

resolveConfig(cfg);

establishWebHooks(cfg, function() {

    connect()
        .use(connect.logger('dev'))
        .use(connect.bodyParser())
        .use(githubHookPath, githubHookHandler(githubClients))
        .use(statusReportPath, statusReporter(githubClients))
        .use(pullRequestReportPath, pullRequestReporter(githubClients))

        // Simple report on what this server is monitoring.
        .use('/', function(req, res) {
            var repoList = '<ul>';
            var itemHtml = Object.keys(githubClients).map(function(key) {
                return '<a target="_blank" href="http://github.com/' + key + '/">http://github.com/' + key + '</a>';
            });
            repoList += '<li>' + itemHtml.join('</li><li>') + '</li></ul>';
            res.setHeader('Content-Type', 'text/html');
            res.end('<html><body>\n<h1>nupic.tools is alive</h1>\n' 
                + '<h3>This server is monitoring the following repositories:</h3>'
                + repoList + '\n</body></html>');
        })
        
        .listen(PORT, function() {
            console.log(('\nServer running at ' + baseUrl + '\n').green);
        });

});
