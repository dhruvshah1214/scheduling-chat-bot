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
var getBusinessData = function(bnameString) {
    var database = firebase.database();
    return database.ref(bnameString + "/").once('value').then(function(snapshot) {
       currentBusiness = snapshot.val();
       console.log(currentBusiness);
   });
}

//========================================================
// Google Calendar Integration
//========================================================

var request = require('request');

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
        if (results && results.entity) {
            // ... save task
            getBusinessData(results.entity);
            session.send("Ok... selected %s", results.entity);
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

dialog.matches('schedule', [
    function (session, args, next) {
        var timeEntity = builder.EntityRecognizer.findEntity(args.entities, 'time');
        var employeeNameEntity = builder.EntityRecognizer.findEntity(args.entities, 'employeeName');
        console.log(JSON.stringify(args.entities));
        var employeeName = null;
        var time = null;
        if (employeeNameEntity && employeeNameEntity.entity) {
            employeeName = employeeNameEntity.entity;
        }
        if(timeEntity && timeEntity.entity) {
            time = timeEntity.entity;
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
        console.log(JSON.stringify(results));
        if (results[0] && !results[1]) {
            // pick any free employee?
        } else if(!results[0] && results[1]) {
            builder.Prompts.time(session, 'What time would you like to set an appointment?');
        }
        else if(results[0] && results[1]) {
            // check if employee is busy
            // if so, ask if want to change times or employess
            // if not, ask to confirm book.

            //request.get('http://google.com/img.png')

        }
        else {
          session.send("I don't understand. Try again.");
        }
    },
    function (session, results) {
         var time = builder.EntityRecognizer.resolveTime([results.response]);
         console.log(JSON.stringify(results.response.entity));

    },

]);

dialog.matches('null',
    function (session) {
        session.send('Sorry, there was an error. Try again.');
    });

dialog.onDefault(function(session){session.send('Sorry, there was an error. Try again.')});
