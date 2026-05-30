# DriveBookVoiceServiceApi.VoiceApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**handleIncomingCall**](VoiceApi.md#handleIncomingCall) | **POST** /voice/incoming | Handle incoming voice call (Twilio webhook)
[**handleVoicemail**](VoiceApi.md#handleVoicemail) | **POST** /voice/voicemail | Handle voicemail recording (Twilio webhook)



## handleIncomingCall

> handleIncomingCall(xTwilioSignature, body)

Handle incoming voice call (Twilio webhook)

Twilio webhook endpoint for incoming calls

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.VoiceApi();
let xTwilioSignature = "xTwilioSignature_example"; // String | Signature sent by Twilio (validate to verify source)
let body = new DriveBookVoiceServiceApi.HandleIncomingCallRequest(); // HandleIncomingCallRequest | 
apiInstance.handleIncomingCall(xTwilioSignature, body, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xTwilioSignature** | **String**| Signature sent by Twilio (validate to verify source) | 
 **body** | [**HandleIncomingCallRequest**](HandleIncomingCallRequest.md)|  | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined


## handleVoicemail

> handleVoicemail(xTwilioSignature, body)

Handle voicemail recording (Twilio webhook)

Twilio webhook for voicemail callbacks

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.VoiceApi();
let xTwilioSignature = "xTwilioSignature_example"; // String | Signature sent by Twilio (validate to verify source)
let body = new DriveBookVoiceServiceApi.HandleVoicemailRequest(); // HandleVoicemailRequest | 
apiInstance.handleVoicemail(xTwilioSignature, body, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xTwilioSignature** | **String**| Signature sent by Twilio (validate to verify source) | 
 **body** | [**HandleVoicemailRequest**](HandleVoicemailRequest.md)|  | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

