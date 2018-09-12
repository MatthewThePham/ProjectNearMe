const Alexa = require('ask-sdk');

//used for a permissions card if the user has not enabled location permission
const PERMISSIONS = ['read::alexa:device:all:address'];

//start of the program 
const LaunchIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest'
    },
    async handle(handlerInput) {
      //set necessary values to the handlerInput
        const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;

      //generate a consent token for user permission to use their address
        const consentToken = requestEnvelope.context.System.user.permissions
          && requestEnvelope.context.System.user.permissions.consentToken;


        //actual code for address fetching  
        if (!consentToken) {
          return responseBuilder
            .speak('Please enable Location permissions in the Amazon Alexa app.')
            .withAskForPermissionsConsentCard(PERMISSIONS)
            .getResponse();
        }
        try {
          //there is a consent token and we are fetching the user address
          const { deviceId } = requestEnvelope.context.System.device;
          const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
          const address = await deviceAddressServiceClient.getFullAddress(deviceId);
    
          console.log('Address successfully retrieved, now responding to user.');
    
          let response;

          //if the user has not put anything in these address text field yet
          if (address.addressLine1 === null && address.city === null) {

            response = responseBuilder
              .speak('It looks like you don\'t have an address set. You can set your address from the companion app.')
              .getResponse();

          } 
          //the user has put their address in the text field
          else {
            const ADDRESS_MESSAGE = await Punction(address.addressLine1, address.city)

            response = responseBuilder
              .speak(ADDRESS_MESSAGE)
              .withStandardCard(ADDRESS_MESSAGE)
              .getResponse();
          }
          return response;
        
        } 
        //there is some sort of error when fetching the address
        catch (error) {
          if (error.name !== 'ServiceError') {
            const response = responseBuilder
              .speak('Uh Oh. Looks like something went wrong.')
              .getResponse();
              return response;
          }
          throw error;
        }
        
        
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {

        var speechText = ' These are some commands in the app';
        const repromptSpeech = ' These are some commands in the app ';

        return handlerInput.responseBuilder
            .speak(speechText)
            .withStandardCard(speechText,repromptSpeech)
            .reprompt(repromptSpeech)
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        return request.type === 'IntentRequest' &&
            (request.intent.name === 'AMAZON.CancelIntent' || request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = ' Cya later';

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

        return handlerInput.responseBuilder.getResponse();
    },
};

const GetAddressError = {
    canHandle(handlerInput, error) {
      return error.name === 'ServiceError';
    },
    handle(handlerInput, error) {
      if (error.statusCode === 403) {
        return handlerInput.responseBuilder
          .speak(messages.NOTIFY_MISSING_PERMISSIONS)
          .withAskForPermissionsConsentCard(PERMISSIONS)
          .getResponse();
      }
      return handlerInput.responseBuilder
        .speak(messages.LOCATION_FAILURE)
        .reprompt(messages.LOCATION_FAILURE)
        .getResponse();
    },
  };


const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log('Error handled:' + error) ;

        return handlerInput.responseBuilder
            .speak('Sorry, I can\'t understand the command. Please say again.')
            .reprompt('Sorry, I can\'t understand the command. Please say again.')
            .getResponse();
    },
};

/********** FUNCTIONS HERE **************/

//This function parses out the whitespaces in the address and city, and calls the getRemoteData() function for geocoding
// after geocoding, the lat and lng are stored as variables. These variables are passed into the 
async function Punction(address, city)
{
  var longitude = ''
  var latitude = ''
  var listOfFuel = ''
  var newAddress = ''
  var outputSpeech = ''
  var newAddress = ''

  var mapQuestGeocode = ''
  var overpassString = ''

    //format string algorithm
  address = address.replace(/ /g,'+')
  city = city.replace(/ /g,'+')


  //Change this to formatted string to look like "410+Terry+Ave+North,Seattle"
  newAddress = address + ',' + city
    
  //mapquest free tier allow for 15,000 requests a month.
  mapQuestGeocode = "http://www.mapquestapi.com/geocoding/v1/address?key=XSrWCuhRGcPPEYkYWIfwjIisN2vMyGct&location="
    + newAddress; 

    //this geocodes the user address
    await getRemoteData(mapQuestGeocode)                                                                        //mapQuestGeoCode getting used
      .then((response) => {
        var data = JSON.parse(response);

        //json data stored into lat and lng
        latitude = data.results[0].locations[0].displayLatLng.lat;
        longitude = data.results[0].locations[0].displayLatLng.lng;
        
      })
      .catch((err) => {
        //set an optional error message here
        //outputSpeech = err.message;
      })

    //Overpass/openstreetmap is open source data so no limit in request.
     overpassString = "http://overpass-api.de/api/interpreter?data=[out:json];(node[%22amenity%22=%22fuel%22]"
    + "(around:8046.72,"    //this is roughly 5 miles
    + latitude + ',' + longitude //this is the actual lat, lon
    + "););out;%3E;";
    

      //this is a query to overpass api to get locations
      await getRemoteData(overpassString)
      .then((response) => {
        var data = JSON.parse(response);

        //gets 5 nodes and stores them into a list. Checks to make sure a name is present and not undef.
        for (let i = 0; i < 6; i++) {  
          if(data.elements[i].tags.name != undefined ){
            listOfFuel = listOfFuel + ' , ' + data.elements[i].tags.name;
          }
        }
      })
      .catch((err) => {
        //set an optional error message here
        //outputSpeech = err.message;
      })
      
    //set data to this returned string, outputSpeech
    outputSpeech = "The latitude is " + latitude + " The longitude is " + longitude + '. The list is '
    + listOfFuel;
    
   return outputSpeech;
}


//This will create a proper web API call using https, checking for different protocol errors
//For all the types of protocol errors, refer to https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
async function getRemoteData (url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? require('https') : require('http');
    const request = client.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {	//this says if there a problem with the request give out error 
        reject(new Error('Failed with status code: ' + response.statusCode));
      }
      const body = [];
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => resolve(body.join('')));
    });
    request.on('error', (err) => reject(err))
  })
};


const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(GetAddressError,ErrorHandler)
    .lambda();

