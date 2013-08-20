var fs = require('fs'),
    url = require('url'),
    qs = require('querystring'),
    shaValidator = require('../utils/shaValidator'),
    contributors = require('../utils/contributors'),
    jsonUtils = require('../utils/json'),
    VALIDATOR_DIR = './validators',
    validators = [],
    repoClients;

function initializeValidators(dir) {
    fs.readdirSync(dir).forEach(function(validator) {
        validators.push(require('.' + dir + '/' + validator.split('.').shift()));
    });
}

function findClientFor(sha, callback) {
    var clients = Object.keys(repoClients),
        found = false;
    function next() {
        var nextClient;
        if (found) return;
        nextClient = repoClients[clients.shift()];
        if (! nextClient) {
            return callback();
        }
        nextClient.getCommit(sha, function(err, commit) {
            if (! err && commit) {
                found = true;
                callback(nextClient, commit);
            } else {
                next();
            }
        });
    }
    next();
}



function validateSha(req, res) {

    var reqUrl = url.parse(req.url),
        query = qs.parse(reqUrl.query),
        sha = query.sha,
        postStatus = query.postStatus || false,
        repo = query.repo,
        jsonPCallback = query.callback,
        repoClient = repoClients[repo],
        errors = [];

    if (! sha) {
        errors.push(new Error('Missing "sha" query parameter.'));
    }
    if (repo && repoClient == undefined) {
        errors.push(new Error('No repo called "' + repo + '".'));
    }
    if (errors.length) {
        return jsonUtils.renderErrors(errors, res, jsonPCallback);
    }

    if (repo && sha == 'all') {
        contributors.getAll(repoClient.contributorsUrl, function(err, contributors) {
            if (err) {
                return jsonUtils.renderErrors([err]);
            }
            shaValidator.revalidateAllOpenPullRequests(contributors, repoClient, validators, function(err, numbers) {
                var htmlOut;
                if (err) {
                    return jsonUtils.renderErrors([err]);
                }
                htmlOut = '<html><body>\n<h1>SHA Validation report</h1>\n';
                htmlOut += '<h2>' + repoClient.toString() + '</h2>\n';
                htmlOut += '<h2>' + sha + '</h2>\n';
                htmlOut += '<h3>Revalidated following prs (by id)</h3>\n';
                htmlOut += '<ul><li>\n';
                htmlOut += numbers.join('</li>\n<li>');
                htmlOut += '</li></ul>\n';
                htmlOut += '\n</body></html>';
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Content-Length', htmlOut.length);
                res.end(htmlOut);
            });
        });
    } else {
        findClientFor(sha, function(client, payload) {
            var committer;
            if (! client) {
                errors.push(new Error('No match for sha "' + sha + '" in any known repositories.'));
                return jsonUtils.renderErrors(errors, res, jsonPCallback);
            }
            committer = payload.author ? payload.author.login : false;
            shaValidator.performCompleteValidation(sha, committer, client, validators, postStatus, function (sha, statusDetails, repoClient) {
                var htmlOut = '<html><body>\n<h1>SHA Validation report</h1>\n';
                htmlOut += '<h2>' + repoClient.toString() + '</h2>\n';
                htmlOut += '<h2>' + sha + '</h2>\n';
                htmlOut += '<h3>' + statusDetails.state + '</h3>\n';
                htmlOut += '<p>' + statusDetails.description + '</p>\n';
                if (statusDetails.target_url) {
                    htmlOut += '<p><a href="' + statusDetails.target_url + '">Details</a></p>\n';
                }
                htmlOut += '\n</body></html>';
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Content-Length', htmlOut.length);
                res.end(htmlOut);
            });
        });
    }

}

initializeValidators(VALIDATOR_DIR);

validateSha.title = 'SHA Validator';
validateSha.description = 'Given a "sha" parameter, forces a complete ' +
    'validation and reports results. To post validation results to github, ' +
    'specify "postStatus=1" in URL params. To force revalidation of all open ' +
    'pull requests, specify "?sha=all&repo=<repo name>" in URL params.';

module.exports = {
    '/validate': function(_repoClients) {
        repoClients = _repoClients;
        return validateSha;
    }
};