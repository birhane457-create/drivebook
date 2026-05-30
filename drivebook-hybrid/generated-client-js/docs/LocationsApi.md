# DriveBookVoiceServiceApi.LocationsApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**validateLocation**](LocationsApi.md#validateLocation) | **POST** /locations/validate | Validate pickup location



## validateLocation

> ValidateLocation200Response validateLocation(body)

Validate pickup location

Validates and geocodes a pickup location. Prevents bad addresses during voice calls. Returns formatted address and coordinates. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.LocationsApi();
let body = new DriveBookVoiceServiceApi.ValidateLocationRequest(); // ValidateLocationRequest | 
apiInstance.validateLocation(body, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**ValidateLocationRequest**](ValidateLocationRequest.md)|  | 

### Return type

[**ValidateLocation200Response**](ValidateLocation200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

