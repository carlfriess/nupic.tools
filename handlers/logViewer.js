var fs = require('fs'),
    AnsiConverter = require('ansi-to-html'),
    converter = new AnsiConverter(),
    logDirectory;

function getLatestModifiedFileIn(dir, filePaths, callback) {
    var latest = null,
        count = 0;
    filePaths.forEach(function(path) {
        if (path.split('.').pop() == 'log') {
            fs.stat(dir + '/' + path, function(err, stats) {
                if (err) throw err;
                if (! latest) {
                    latest = { path: path, mtime: stats.mtime};
                } else {
                    if (stats.mtime > latest.mtime) {
                        latest = { path: path, mtime: stats.mtime};
                    }
                }
                if (++count == (filePaths.length - 1)) {
                    callback(null, latest.path);
                }
            });
        } else {
            if (++count == (filePaths.length - 1)) {
                callback(null, latest.path);
            }
        }
    });
}

function logViewer(req, res) {
    fs.readdir(logDirectory, function(err, files) {
        if (err) throw err;
        // console.log(files);
        getLatestModifiedFileIn(logDirectory, files, function(err, latestLogFilePath) {
            if (err) throw err;
            fs.readFile(logDirectory + '/' + latestLogFilePath, 'utf-8', function(err, ansiOut) {
                if (err) throw err;
                var style = '<style>body { background: black; color: white; font: 14pt Courier; }</style>\n',
                    htmlOut = '<html><head>' + style + '</head><body>\n<h1>nupic.tools current logs:</h1>\n',
                    ansiHtml = converter.toHtml(ansiOut);
                ansiHtml = ansiHtml.replace(/\n/g, '\n<br/>');
                htmlOut += ansiHtml;
                htmlOut += '\n</body></html>';
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Content-Length', htmlOut.length);
                res.end(htmlOut);            
            });
        });
    });

}

logViewer.title = 'Log Viewer';
logViewer.description = 'Provides an HTML display of the nupic.tools server logs. Defaults to display the most recent log file.';

module.exports = {
    '/logs': function(_, _, config) {
        logDirectory = config.logDirectory;
        // TODO: validate log directory here
        return logViewer;
    }
};