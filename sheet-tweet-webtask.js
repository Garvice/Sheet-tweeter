var tweetTextColumnId = '7697442956175236';
var tweetStartColumnId = '2067943421962116';
var tweetEndColumnId = '6571543049332612';
var tweetFrequencyColumnId = '4319743235647364';
var tweetFrequencyTypeColumnId = '8823342863017860';
var tweetLastRanColumnId = '5953924873119620';


module.exports = function (ctx, cb) {
    var smartsheet = require('smartsheet');
    var Twit = require('twit');

    var T = new Twit({
        consumer_key: ctx.secrets.TWITTER_CONSUMER_KEY,
        consumer_secret: ctx.secrets.TWITTER_CONSUMER_SECRET,
        access_token: ctx.secrets.TWITTER_ACCESS_TOKEN,
        access_token_secret: ctx.secrets.TWITTER_ACCESS_SECRET,
        timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
    });

    // Set options.
    var options = {
        id: ctx.secrets.SMARTSHEET_SHEET_ID // Id of Sheet
    };

    // Initialize client SDK
    var smartsheetClient = smartsheet.createClient({
        accessToken: ctx.secrets.SMARTSHEET_ACCESS_TOKEN
    });

    var getRowValues = function (row) {
        var rowValues = {};
        row.cells.forEach(function (cell) {
            var columnId = cell.columnId;
            rowValues[columnId] = cell.value;
        });
        return rowValues;
    };

    var tweet = function (update) {
        T.post('statuses/update', {
            status: update
        }, (err, data, response) => {
            console.log(data);
            console.log(`error ${err}`);
        });
    };


    var updateSheetTweet = function (row) {
        var rowUpdate = [
            {
                "id": row.id,
                "cells": [
                    {
                        "columnId": tweetLastRanColumnId,
                        "value": Date.now()
                    }
                ]
            }
        ];

        var options = {
            body: rowUpdate,
            sheetId: ctx.secrets.SMARTSHEET_SHEET_ID
        };

        smartsheetClient.sheets.updateRow(options)
            .then(function (data) {
                console.log(data);
            })
            .catch(function (error) {
                console.log(error);
            });
    };

    smartsheetClient.sheets.getSheet(options)
        .then(function (data) {
            for (var i = 0; i < data.rows.length; i++) {
                var rowValues = getRowValues(data.rows[i]);
                var tweetStartDate = Date.parse(rowValues[tweetStartColumnId]);
                var tweetEndDate = Date.parse(rowValues[tweetEndColumnId]);

                if (tweetStartDate > Date.now() || tweetEndDate < Date.now()) {
                    console.log(`Don't tweet - start: ${tweetStartDate} end: ${tweetEndDate}`);
                    continue;
                }

                if (!rowValues[tweetLastRanColumnId]) {
                    console.log(rowValues[tweetTextColumnId]);
                    tweet(rowValues[tweetTextColumnId]);
                    updateSheetTweet(data.rows[i]);
                    return cb();
                }

                var nextTweet = new Date(rowValues[tweetLastRanColumnId]);

                switch (rowValues[tweetFrequencyTypeColumnId]) {
                    case "hour":
                        nextTweet.setHours(
                            nextTweet.getHours() + rowValues[tweetFrequencyColumnId]
                        );
                        break;
                    case "day":
                        nextTweet.setDate(
                            nextTweet.getDate() + rowValues[tweetFrequencyColumnId]
                        );
                        break;
                    case "week":
                        nextTweet.setDate(
                            nextTweet.getDate() + rowValues[tweetFrequencyColumnId] * 7
                        );
                        break;
                    case "month":
                        nextTweet.setMonth(
                            nextTweet.getMonth() + rowValues[tweetFrequencyColumnId]
                        );
                        break;
                }
                if (nextTweet.getTime() < Date.now()) {
                    tweet(rowValues[tweetTextColumnId]);
                    updateSheetTweet(data.rows[i]);
                    console.log(rowValues[tweetTextColumnId]);
                    return cb();
                }
            }
            cb();
        });
};