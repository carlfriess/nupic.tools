var jsdom = require("jsdom");
var nodeURL = require("url");
var jsonUtils = require('../utils/json');

function mailingListReporter (request, response) {

    var total;
    var numberSubsHTML;
    var numberSubsNoDigest;
    var numberSubsDigest;

    var requestCount;
    var urls = [];
    var data = {};

    var monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var month;
    var year;
    var date
    var arrayPos;


    data.messages = {};
    requestCount = 0;
    total = 0;

    urls.push({"url":"http://lists.numenta.org/mailman/roster/nupic_lists.numenta.org"});

    month = 4;    //Start in May
    year = 2013;  //Start in 2013
    date = new Date();
    arrayPos = 0;
    while (year <= date.getYear() || month <= date.getMonth()) {

        urls.push({
            "url":"http://lists.numenta.org/pipermail/nupic_lists.numenta.org/"+year+"-"+monthNames[month]+"/date.html",
            "month":month,
            "year":year,
            "arrayPos":arrayPos
        });

        arrayPos++;
        month++;
        if(month == 12) {

            month = 0;
            year++;

        }

    }

    jsdom.env(urls.shift().url,["http://code.jquery.com/jquery.js"], function (errors, window) {

        numberSubsHTML = window.$("center b font");
        numberSubsNoDigest = parseInt((numberSubsHTML[0]).innerHTML.split(" ").shift());
        numberSubsDigest = parseInt((numberSubsHTML[1]).innerHTML.split(" ").shift());
        data.subscribers = numberSubsNoDigest + numberSubsDigest;
        requestCount++;
        if (requestCount >= urls.length + 1) {
            data.messages.total = total;
            buildOutput(request, response, data);
        }

    });

    data.messages.byMonth = [];

    urls.forEach(function(url) {

        jsdom.env(url.url,["http://code.jquery.com/jquery.js"], function (errors, window) {

            var temp = {};
            temp.name = monthNames[url.month] + " " + url.year;
            temp.month = url.month;
            temp.year = url.year;
            temp.number = (window.$("a").length-10)/2;
            data.messages.byMonth[url.arrayPos] = temp;
            total += (window.$("a").length-10)/2;
            requestCount++;
            if (requestCount >= urls.length + 1) {
                data.messages.total = total;
                buildOutput(request, response, data);
            }

        });

    });

}

function buildOutput (request, response, data)  {

    if(nodeURL.parse(request.url,false,true).pathname.split(".").pop() == "json")    {

        if(nodeURL.parse(request.url).query !== null)   {

            jsonUtils.renderJsonp(data, nodeURL.parse(request.url, true).query.callback, response);

        }   else    {

            jsonUtils.render(data,response);

        }

    }   else    {

        response.write("<html><head><title>Mailing List Statistics</title></head><body style='background-color: #F0F2F2;'><div style='width: 400px; margin-left: auto; margin-right: auto; margin-top: 50px; font-family: Arial; background-color: #EAEAEA; box-shadow: 1px 1px 50px 5px rgba(0, 0, 0, 0.5); -webkit-box-shadow: 1px 1px 50px 5px rgba(0, 0, 0, 0.5); padding: 25px; -webkit-border-radius: 10px; border-radius: 10px;'><center><span style='line-height: 50px;'><b style='font-size:24px;'>Mailing List Statistics</b><br />Total Subscribers: ");
        response.write(data.subscribers.toString());
        response.write("<br /></span><b>Number of messages by month:</b></center><table style='width: 200px; margin-left: auto; margin-right: auto;'>");
        data.messages.byMonth.forEach(function(nextMonthData) {

            response.write("<tr><td>");
            response.write(nextMonthData.name);
            response.write("</td><td style='width: 75px; text-align: right;'>");
            response.write(nextMonthData.number.toString());
            response.write("</td></tr>");

        });
        response.write("<tr><b><td><b>TOTAL</b></td><td style='width: 75px; text-align: right;'><b>");
        response.write(data.messages.total.toString());
        response.write("</b></td></tr></table></div></body></html>");

        response.end();

    }

}



mailingListReporter.title = 'Mailing List Reporter';
mailingListReporter.description = 'Provides statistics about the mailing list. (Outputs HTML or JSON depending on extention [*.html or *.json]. For JASONP add query "callback" [ex.: ...?callback=foo].)';

module.exports = {
    '/maillist': function() {
        return mailingListReporter;
    }
};