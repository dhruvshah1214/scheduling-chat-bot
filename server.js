var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
 console.log('%s listening to %s', server.name, server.url); 
});

var appId = process.env.MICROSOFT_APP_ID;
var appPwd = process.env.MICROSOFT_APP_SECRET;

if(appId == null) {
	appId = 'd634bd93-44f5-4466-9758-631f96e732a5';
}
if(appPwd == null) {
	appPwd = 'ik59TDcGc7UZhZZrnjARtWv';
}
//console.log(appId);  

// Create chat bot
var connector = new builder.ChatConnector({
    appId: appId,
    appPassword: appPwd
});
var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen());

var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/cc3a928a-5cc7-4e98-aa38-cd8187c96f7e?subscription-key=c88e1619559b44e4a03977b90b92bc08';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });


//========================================================
// Firebase integrations/variables
//========================================================

var firebase = require("firebase");

// Initialize Firebase
var config = {
	apiKey: "AIzaSyAV7G1bMr6mjVCRzcR4cVWaYNL5XEcrDGk",
	authDomain: "scheduleme-f5d58.firebaseapp.com",
	databaseURL: "https://scheduleme-f5d58.firebaseio.com",
	storageBucket: "scheduleme-f5d58.appspot.com"
};
firebase.initializeApp(config);
var defaultDatabase = firebase.database();
var currentBusiness = null;
var businessName = null;
var getBusinessData = function(bnameString, callback) {
    var database = firebase.database();
    database.ref(bnameString + "/").once('value').then(function(snapshot) {
       currentBusiness = snapshot.val();
       businessName = bnameString;
       console.log(currentBusiness);
       callback();
   });
}

function formatDate(date) {
  var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();

  return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

//========================================================
// Helper Dependencies
//========================================================

var request = require('request');
var dateFormat = require('dateformat');
var moment = require('moment');

var userID = null;
var canableAppts = {};


function sameDay(date1, date2) {
    return (date1.getFullYear() === date2.getFullYear()) && (date1.getMonth() === date2.getMonth()) && (date1.getDate() == date2.getDate());
}

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', dialog);

dialog.matches('selectBusiness', [
    function (session, args, next) {
        var bname = builder.EntityRecognizer.findEntity(args.entities, 'BusinessName');
        //console.log('NAME: %s', bname.entity);
        next(bname);
    },
    function (session, results) {
        userID = session.message.user.id;
        console.log(userID);
        if (results && results.entity) {
            // ... save task
            getBusinessData(results.entity, function() {
                if (currentBusiness) {
                    session.send("Ok... selected %s", results.entity);
                }
                else {
                    session.send("Couldn't find a business by that name. Try again.");
                }
            });
            
        } else {
            session.send("Couldn't find a business name in your request. Try again.");
        }
    }
]);

dialog.matches('contactManager', 
    function (session, args, next) {
        if(currentBusiness) {
            session.send('%s', currentBusiness.phone);
        }
        else {
          session.send("Select a business to get contact information from");
      }
  }
);

dialog.matches('query', [
    function (session, args, next) {
        var timeEntity = builder.EntityRecognizer.resolveTime(args.entities);
        var employeeNameEntity = builder.EntityRecognizer.findEntity(args.entities, 'employeeName');
        //console.log(JSON.stringify(args.entities));
        var employeeName = null;
        var time = null;
        if (employeeNameEntity && employeeNameEntity.entity) {
            employeeName = employeeNameEntity.entity;
        }
        if(timeEntity) {
            var newTime = timeEntity.getTime() + 7 * 60 * 60 * 1000;
            var realE = moment(newTime).utc();
            time = realE.valueOf();
        }
        else {
            for(var dict in args.entities) {
                if (dict['type'] === "builtin.datetime.time") {
                    time = dict['entity'];
                }
            }
        }
        next([time, employeeName]);
    },
    function (session, results) {
        //console.log(JSON.stringify(results));
        if (results[0] && !results[1]) {
            //invalid; time, but no employee given


        } else if(!results[0] && results[1]) {
            // no time, employee given; show next five busy items
            if(currentBusiness) {
                var url = 'https://www.googleapis.com/calendar/v3/calendars/' + currentBusiness['calendarId'] + '/events?&access_token=' + currentBusiness.accessKey;
                // console.log(JSON.stringify(url));
                request.get(url, function (error, response, body) {
                if(error != null || body.error != null) {

                }
                else {
                    //console.log(body);
                    var bodyJSON = JSON.parse(body);
                    //console.log(bodyJSON["items"]);
                    if(bodyJSON["items"].length > 0) {
                        session.send("%s is busy from...", results[1]);
                    }
                    else {
                        // console.log("NO ITEMS");
                    }
                    var itemsJSON = bodyJSON["items"];
                    // console.log(itemsJSON);
                    for(i = 0; i < Math.min(itemsJSON.length, 5); i++) {
                        
                        var evJSON = itemsJSON[i];
                        if (evJSON["summary"].toLowerCase().trim() == results[1].toLowerCase().trim()) {
                            var startDate = new Date(evJSON["start"]["dateTime"]);
                            var endDate = new Date(evJSON["end"]["dateTime"]);
                            var startDateString = dateFormat(startDate, "mmmm dS, h:MM TT");
                            var endDateString = null;
                            if (sameDay(startDate, endDate)) {
                                endDateString = dateFormat(endDate, "h:MM TT");
                            }
                            else {
                                endDateString = dateFormat(endDate, "mmmm dS, h:MM TT");
                            }
                            // console.log("send");
                            session.send("%s to %s", startDateString, endDateString);
                        }
                    }

                }
                });
            }
            else {
                session.send("No business selected. Select a business and try again.");
            }
            
        }
        else if(results[0] && results[1]) {
            // time and employee
            // use google's freebusy to return free or busy

            if(currentBusiness) {
                var url = 'https://www.googleapis.com/calendar/v3/calendars/' + currentBusiness['calendarId'] + '/events?orderBy=startTime&singleEvents=true&access_token=' + currentBusiness.accessKey;
                // console.log(JSON.stringify(url));
                request.get(url, function (error, response, body) {
                if(error != null || body.error != null) {

                }
                else {
                    //console.log(body);
                    var isClean = true;
                    var bodyJSON = JSON.parse(body);
                    // console.log(bodyJSON["items"]);
                    var itemsJSON = bodyJSON["items"];
                    // console.log(itemsJSON);
                    for(i = 0; i < itemsJSON.length; i++) {
                        
                        var evJSON = itemsJSON[i];
                        if (evJSON["summary"].toLowerCase().trim() == results[1].toLowerCase().trim()) {
                            var startDate = new Date(evJSON["start"]["dateTime"]);
                            var endDate = new Date(evJSON["end"]["dateTime"]);
                            
                            var mxtime = currentBusiness["maxTime"];
                            if (mxtime == 0 || mxtime == null || isNaN(mxtime)) {
                                mxtime = 60; //hardcoded
                            }

                            var sstart = moment(results[0]).valueOf();
                            var hasOverlap = Math.max(startDate.getTime(), results[0]) < Math.min(endDate.getTime(), results[0] + mxtime * 60000);

                            if (hasOverlap) {
                                isClean = false;
                                break;
                            }
                        }
                    }
                    if (isClean) {
                        session.send("%s is completely free during that time!", results[1]);
                    }
                    else {
                        session.send("Sorry, but %s is not available during that time.", results[1]);
                    }
                }
                });
            }
            else {
                session.send("No business selected. Select a business and try again.");
            }

        }
        else {
          session.send("I don't understand. Try again.");
        }
    }
]);


dialog.matches('schedule', [
    function (session, args, next) {
        var timeEntity = builder.EntityRecognizer.resolveTime(args.entities);
        var employeeNameEntity = builder.EntityRecognizer.findEntity(args.entities, 'employeeName');
        //console.log(JSON.stringify(args.entities));
        var employeeName = null;
        var time = null;
        if (employeeNameEntity && employeeNameEntity.entity) {
            employeeName = employeeNameEntity.entity;
        }
        if(timeEntity) {
            var newTime = timeEntity.getTime() + 7 * 60 * 60 * 1000;
            var realE = moment(newTime).utc();
            time = realE.valueOf();
        }
        else {
            for(var dict in args.entities) {
                if (dict['type'] === "builtin.datetime.time") {
                    time = dict['entity'];
                }
            }
        }
        next([time, employeeName]);
    },
    function (session, results) {
        //console.log(JSON.stringify(results));
        if (results[0] && !results[1]) {
            //time but no preference
            session.send(" time, no emp");

        } else if(!results[0] && results[1]) {
            // no time, employee given; request time
            session.send("No time, b emp");
        }
        else if(results[0] && results[1]) {
            // time and employee
            // add an event to google cal
            if(currentBusiness) {
                var url = 'https://www.googleapis.com/calendar/v3/calendars/' + currentBusiness['calendarId'] + '/events?access_token=' + currentBusiness.accessKey;
                var mxtime = currentBusiness["maxTime"];
                if (mxtime == 0 || mxtime == null || isNaN(mxtime)) {
                    mxtime = 60; //hardcoded
                }
                var sT = moment(results[0]).utc();
                var endT = moment(results[0] + 60000 * mxtime).utc();
                var postData = {
                    summary: results[1].toLowerCase(),
                    start: {dateTime: sT},
                    end: {dateTime: endT},
                    description: userID
                };
                var options = {
                  method: 'POST',
                  body: postData,
                  json: true,
                  url: url
                };
                request(options, function (error, response, body) {
                    if(error != null || body.error != null) {
                        console.log(error);
                        console.log(body.error);
                    }
                    else {
                        console.log(body);
                        if (body["kind"] != "calendar#event") {
                            session.send("There was an error creating the event.");
                        }
                        else {
                            session.send("Event created!");
                        }
                    }
                });
            }
            else {
                session.send("No business selected. Select a business and try again.");
            }

        }
        else {
          session.send("I don't understand. Try again.");
        }
    }
]);

dialog.matches('viewAppointment',
    function(session, args, next) {
        if(currentBusiness) {
                var url = 'https://www.googleapis.com/calendar/v3/calendars/' + currentBusiness['calendarId'] + '/events?&access_token=' + currentBusiness.accessKey;
                // console.log(JSON.stringify(url));
                request.get(url, function (error, response, body) {
                if(error != null || body.error != null) {
                    session.send("Error.");
                }
                else {
                    //console.log(body);
                    var bodyJSON = JSON.parse(body);
                    //console.log(bodyJSON["items"]);
                    var itemsJSON = bodyJSON["items"];
                    // console.log(itemsJSON);
                    for(i = 0; i < itemsJSON.length; i++) {
                        
                        var evJSON = itemsJSON[i];
                        // console.log(evJSON["description"]);

                        if (evJSON["description"]) {
                            if (evJSON["description"].trim() == userID.trim()) {
                                //console.log(evJSON["start"]["dateTime"]);
                                var startDate = new Date(evJSON["start"]["dateTime"]);
                                var startDateM = moment(startDate).utcOffset('-0700');

                                var endDate = new Date(evJSON["end"]["dateTime"]);
                                var endDateM = moment(endDate).utcOffset('-0700');

                                var startDateString = startDateM.format('MMM Do, h:mma');
                                var endDateString = null;
                                if (sameDay(startDate, endDate)) {
                                    endDateString = endDateM.format('h:mma');
                                }
                                else {
                                    endDateString = endDateM.format('MMM Do, h:mma');
                                }
                                // console.log("send");
                                console.log(currentBusiness);
                                session.send("You have an appointment at %s, on %s to %s", businessName, startDateString, endDateString);
                            }
                        }
                        else {
                            session.send("Error.");
                        }
                    }

                }
                });
            }
            else {
                session.send("No business selected. Select a business and try again.");
            }
    }
);


dialog.matches('cancelAppointment', [ 
    function(session, args, next) {
        if(currentBusiness) {
                var url = 'https://www.googleapis.com/calendar/v3/calendars/' + currentBusiness['calendarId'] + '/events?access_token=' + currentBusiness.accessKey;
                // console.log(JSON.stringify(url));
                request.get(url, function (error, response, body) {
                if(error != null || body.error != null) {

                }
                else {
                    //console.log(body);
                    var bodyJSON = JSON.parse(body);
                    //console.log(bodyJSON["items"]);
                    var itemsJSON = bodyJSON["items"];
                    // console.log(itemsJSON);
                    for(i = 0; i < itemsJSON.length; i++) {
                        
                        var evJSON = itemsJSON[i];
                        // console.log(evJSON["description"]);

                        if (evJSON["description"]) {
                            if (evJSON["description"].trim() == userID.trim()) {
                                var summ = evJSON["summary"];
                                var startDate = new Date(evJSON["start"]["dateTime"]);
                                var endDate = new Date(evJSON["end"]["dateTime"]);
                                var startDateString = dateFormat(startDate, "mmmm dS, h:MM TT");
                                var endDateString = null;
                                if (sameDay(startDate, endDate)) {
                                    endDateString = dateFormat(endDate, "h:MM TT");
                                }
                                else {
                                    endDateString = dateFormat(endDate, "mmmm dS, h:MM TT");
                                }
                                var fullS = businessName + ", " + startDateString + " to " + endDateString;
                                canableAppts[fullS] = evJSON["id"];
                             }
                        }
                    }
                    builder.Prompts.choice(session, "Choose an appointment to cancel.", canableAppts, { listStyle: builder.ListStyle.button })

                }
                });
            }
            else {
                session.send("No business selected. Select a business and try again.");
            }
    },
    function (session, results) {
        if (results.response) {
            var eventID = canableAppts[results.response.entity];
            request.delete("https://www.googleapis.com/calendar/v3/calendars/" + currentBusiness.calendarId + "/events/" + eventID + "?access_token=" + currentBusiness.accessKey);
            session.send("Appointment deleted!");
        } else {
            session.send("Unable to delete appointment.");
        }

    }
]);


dialog.matches('null',
    function (session) {
        session.send('Sorry, there was an error. Try again.');
    });

dialog.onDefault(function(session){session.send('Sorry, there was an error. Try again.')});
