'use strict';

/**
 */
var http = require("http");
var https = require("https");

/**
 * getJSON:  REST get request returning JSON object(s)
 * @param options: http options object
 * @param callback: callback to pass the results JSON object(s) back
 */
function getJSON(options, onResult)
{
    console.log("rest::getJSON");

    var prot = options.port == 443 ? https : http;
    var req = prot.request(options, function (res)
    {
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function () {
            var obj = null;
            if (res.statusCode === 200) {
                obj = JSON.parse(output);
            }
            onResult(res.statusCode, obj);
        });
    });

    req.on('error', function (err) {
        //res.send('error: ' + err.message);
    });

    req.end();
}
;

// --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message,
        },
    };
}

function close(sessionAttributes, fulfillmentState, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState,
            message,
        },
    };
}

function delegate(sessionAttributes, slots) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Delegate',
            slots,
        },
    };
}

// ---------------- Helper Functions --------------------------------------------------



function buildValidationResult(isValid, violatedSlot, messageContent) {
    if (messageContent == null) {
        return {
            isValid,
            violatedSlot,
        };
    }
    return {
        isValid,
        violatedSlot,
        message: {contentType: 'PlainText', content: messageContent},
    };
}

function getWordDomains(callback) {
    var wordDomains = [];

    var options = {
        host: 'od-api.oxforddictionaries.com',
        port: 443,
        path: '/api/v1/domains/en',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            "app_id": "3fabd331",
            "app_key": "a2b1fe823d8c6dcb9243341c3a50394a"
        }
    };
    getJSON(options, function (statusCode, result) {
        if (statusCode !== 200) {
            var emptyArray = [];
            callback(emptyArray);
        } else {
            var wdInternal = [];
//        var i = 0;
            var jsonObject = result.results;
            for (var property in jsonObject) {
                if (jsonObject.hasOwnProperty(property)) {
                    var str = jsonObject[property]["en"].toString().toLowerCase();
                    wdInternal.push(str);
                }
            }
            console.log("wdInternal: ", wdInternal, "length: ", wdInternal.length);
            callback(wdInternal);
        }
    });

//    console.log("wordDomains: ", wordDomains, "length: ", wordDomains.length);
//
    return wordDomains;
}

function getNewWordToLearn(wordDomain, prevWord, callback) {
    console.log("entry to getNewWordToLearn");

    var path = '/api/v1/wordlist/en/domains%3D' + wordDomain.split(' ').join('_');
    console.log("path: ", path);

    var options = {
        host: 'od-api.oxforddictionaries.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            "app_id": "3fabd331",
            "app_key": "a2b1fe823d8c6dcb9243341c3a50394a"
        }
    };
    getJSON(options, function (statusCode, result) {
        console.log("statusCode: ", statusCode);
        if (statusCode !== 200) {
            callback({wordToLearn: null,
                wordDefinition1: null,
                wordDefinition2: null});
        } else {
            var wordsArray = result.results;

            var curWordIdx = -1;
            for (var index = 0; index < wordsArray.length; ++index) {
                if (wordsArray[index]["word"] === prevWord) {
                    curWordIdx = index;
                    break;
                }
            }

            if (curWordIdx + 1 < wordsArray.length) {
                var newWord = wordsArray[curWordIdx + 1]["word"];
                console.log("newWord: ", newWord);
                getWordDefinition(newWord, callback);
//            callback(newWord);
            } else {
                callback({wordToLearn: null,
                    wordDefinition1: null,
                    wordDefinition2: null});
            }
        }
    });
}

function getWordDefinition(prevWord, callback) {
    console.log("entry to getWordDefinition");

    var path = '/api/v1/entries/en/' + prevWord.split(' ').join('_') + "/definitions";
    console.log("path: ", path);

    var options = {
        host: 'od-api.oxforddictionaries.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            "app_id": "3fabd331",
            "app_key": "a2b1fe823d8c6dcb9243341c3a50394a"
        }
    };
    getJSON(options, function (statusCode, result) {
        console.log("statusCode: ", statusCode);
        if (statusCode !== 200) {
            callback({wordToLearn: null,
                wordDefinition1: null,
                wordDefinition2: null});
        } else {
            var wordsDefArray = result.results;
            console.log("wordsDefArray: ", wordsDefArray);
            var def1 = wordsDefArray[0]["lexicalEntries"][0]["entries"][0]["senses"][0]["definitions"][0];
            console.log("def1: ", def1);
            callback({wordToLearn: prevWord,
                wordDefinition1: def1,
                wordDefinition2: null});
        }
    });
}

function StopWord() {
    return "stop";
}

function saySpeechForWordDefinitions(newWordToLearn) {
    if (newWordToLearn.wordDefinition1 && newWordToLearn.wordDefinition2) {
        return "It's first definition is: " + newWordToLearn.wordDefinition1
                + " and second definition is: " + newWordToLearn.wordDefinition2;
    } else if (newWordToLearn.wordDefinition1 && !newWordToLearn.wordDefinition2) {
        return "It's definition is: " + newWordToLearn.wordDefinition1;
    } else if (!newWordToLearn.wordDefinition1) {
        return "Something wrong, I don't know the definition of this word!";
    }
}

function replyToStopWord() {
    return "Well, thank you, good bye!";
}

function learnEnglish(intentRequest, callback) {
    const currentSessionAttributes = intentRequest.sessionAttributes;
    console.log("currentSessionAttributes = ", currentSessionAttributes);
    const currentWordToLearn = intentRequest.sessionAttributes.wordToLearn;
    console.log("currentWordToLearn = ", currentWordToLearn);
    const currentWordDomain = intentRequest.sessionAttributes.currentWordDomain;

    const wordDomain = intentRequest.currentIntent.slots.WordDomain;
    const userAnswer = intentRequest.currentIntent.slots.UserAnswer;
//    const date = intentRequest.currentIntent.slots.PickupDate;
//    const time = intentRequest.currentIntent.slots.PickupTime;
    const source = intentRequest.invocationSource;
    console.log(`wordDomain=${wordDomain}, userAnswer=${userAnswer}, source=${source}`);
    console.log('slots = ', intentRequest.currentIntent.slots);

    if (source === 'DialogCodeHook') {
        // Perform basic validation on the supplied input slots.  Use the elicitSlot dialog action to re-prompt for the first violation detected.
        console.log("ok, source is DialogCodeHook");
        const slots = intentRequest.currentIntent.slots;
        if (wordDomain && !currentWordDomain) {
            // async call for wordDomain check
            console.log("wordDomain && !currentWordDomain");
            getWordDomains(function (wordDomains) {
                console.log("returned wordDomains: ", wordDomains);
                if (wordDomains.length === 0) {
                    const validationResult = buildValidationResult(false, 'WordDomain', `Problem with dictionary service, sorry...`);
                    if (!validationResult.isValid) {
                        slots[`${validationResult.violatedSlot}`] = null;
                        callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                        return;
                    }
                } else {
                    if (wordDomains.indexOf(wordDomain.toLowerCase()) === -1) {
                        console.log(`check 1 userAnswer=${userAnswer}, wordDomain=${wordDomain}`);
                        const validationResult = buildValidationResult(false, 'WordDomain', `We do not have ${wordDomain}, would you like another domain?  Most popular is ${wordDomains[1]}`);
                        if (!validationResult.isValid) {
                            slots[`${validationResult.violatedSlot}`] = null;
                            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                            return;
                        }

                    } else {
                        console.log("we contain such domain");
                        getNewWordToLearn(wordDomain, currentWordToLearn,
                                function (newWordToLearn) {
                                    if (!newWordToLearn.wordToLearn) {
                                        console.log("problem with newWordToLearn: ", newWordToLearn);
                                        const validationResult = buildValidationResult(false, 'UserAnswer', `Problem with dictionary service, sorry...`);
                                        if (!validationResult.isValid) {
                                            slots[`${validationResult.violatedSlot}`] = null;
                                            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                                            return;
                                        }
                                    } else {
//                                const newWordToLearn = {};
                                        console.log("newWordToLearn: ", newWordToLearn);
                                        const outputSessionAttributes = intentRequest.sessionAttributes || {};
                                        outputSessionAttributes.currentWordDomain = wordDomain;
                                        outputSessionAttributes.wordToLearn = newWordToLearn.wordToLearn;
                                        outputSessionAttributes.wordDefinition1 = newWordToLearn.wordDefinition1;
                                        outputSessionAttributes.wordDefinition2 = newWordToLearn.wordDefinition2;
                                        callback(delegate(outputSessionAttributes, intentRequest.currentIntent.slots));
                                        return;
                                    }
                                });

                    }
                }
            });
        } else if (currentWordDomain && !userAnswer) {
            console.log("currentWordDomain domain defined");
        } else if (currentWordDomain && userAnswer && currentWordToLearn) {
            console.log("currentWordDomain domain and userAnswer and currentWordToLearn defined");
            if (userAnswer === StopWord()) {
                console.log("got stop word");

                callback(close(intentRequest.sessionAttributes, 'Fulfilled',
                        {contentType: 'PlainText', content: replyToStopWord()}));


            } else if (userAnswer !== StopWord() && userAnswer === currentWordToLearn) {
                console.log("doesn't got stop word");
                getNewWordToLearn(wordDomain, currentWordToLearn,
                        function (newWordToLearn) {
//                                const newWordToLearn = {};
                            console.log("newWordToLearn: ", newWordToLearn);

                            if (!newWordToLearn.wordToLearn) {
                                console.log("problem with newWordToLearn: ", newWordToLearn);
                                const validationResult = buildValidationResult(false, 'UserAnswer', `Problem with dictionary service, sorry...`);
                                if (!validationResult.isValid) {
                                    slots[`${validationResult.violatedSlot}`] = null;
                                    callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                                    return;
                                }
                            } else {
                                const outputSessionAttributes = intentRequest.sessionAttributes || {};
                                outputSessionAttributes.currentWordDomain = wordDomain;
                                outputSessionAttributes.wordToLearn = newWordToLearn.wordToLearn;
                                outputSessionAttributes.wordDefinition1 = newWordToLearn.wordDefinition1;
                                outputSessionAttributes.wordDefinition2 = newWordToLearn.wordDefinition2;

                                console.log("ok, try to repeat");
                                const validationResult = buildValidationResult(false, 'UserAnswer',
                                        `Yeah! Let's learn next word. It is "${newWordToLearn.wordToLearn}". ` +
                                        saySpeechForWordDefinitions(newWordToLearn) +
                                        `. Repeat it please: "${newWordToLearn.wordToLearn}"`);
                                if (!validationResult.isValid) {
                                    slots[`${validationResult.violatedSlot}`] = null;
                                    callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                                    return;
                                } else {
                                    console.log("not valid in getting newWordToLearn");
                                }
                                return;
                            }

                        });
            } else if (userAnswer !== StopWord() && userAnswer !== currentWordToLearn) {
                const validationResult = buildValidationResult(false, 'UserAnswer', `I did not understand that, please repeat "${currentWordToLearn}"`);
                if (!validationResult.isValid) {
                    slots[`${validationResult.violatedSlot}`] = null;
                    callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                    return;
                } else {
                    console.log("strange");
                }
            }

        } else {
            console.log("last else case");
            const validationResult = buildValidationResult(false, 'WordDomain', `Please, provide us with word domain`);
            if (!validationResult.isValid) {
                slots[`${validationResult.violatedSlot}`] = null;
                callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
                return;
            } else {

            }
        }
    } else {
        callback(close(intentRequest.sessionAttributes, 'Fulfilled',
                {contentType: 'PlainText', content: replyToStopWord()}));
    }
}

// --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */
function dispatch(intentRequest, callback) {
    console.log(`dispatch userId=${intentRequest.userId}, intentName=${intentRequest.currentIntent.name}`);

    const intentName = intentRequest.currentIntent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'LearnNewEnglishWords') {
        return learnEnglish(intentRequest, callback);
    }
    throw new Error(`Intent with name ${intentName} not supported`);
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
    try {
        // By default, treat the user request as coming from the America/New_York time zone.
        process.env.TZ = 'America/New_York';
        console.log('ok, I am here');
        console.log(`event.bot.name=${event.bot.name}`);

        dispatch(event, (response) => callback(null, response));
    } catch (err) {
        callback(err);
    }
};
