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
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_SECRET
});
var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen());

var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/cc3a928a-5cc7-4e98-aa38-cd8187c96f7e?subscription-key=c88e1619559b44e4a03977b90b92bc08';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', dialog);

dialog.matches('selectBusiness', [
    function (session, args, next) {
        var bname = builder.EntityRecognizer.findEntity(args.entities, 'BusinessName');
        next(bname);
    },
    function (session, results) {
        if (results.response) {
            // ... save task
            session.send("Ok... selected %s", results.response);
        } else {
            session.send("Ok");
        }
    }
]);
