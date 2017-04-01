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
    appId: "d634bd93-44f5-4466-9758-631f96e732a5",
    appPassword: "ik59TDcGc7UZhZZrnjARtWv"
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


