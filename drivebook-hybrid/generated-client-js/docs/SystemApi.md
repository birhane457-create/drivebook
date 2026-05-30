# DriveBookVoiceServiceApi.SystemApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**healthCheck**](SystemApi.md#healthCheck) | **GET** /health | Health check endpoint



## healthCheck

> HealthCheck200Response healthCheck()

Health check endpoint

Check if the service is running and database is connected

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.SystemApi();
apiInstance.healthCheck((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**HealthCheck200Response**](HealthCheck200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

