# DriveBookVoiceServiceApi.PackagesApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getPackages**](PackagesApi.md#getPackages) | **GET** /packages | Get available lesson packages



## getPackages

> GetPackages200Response getPackages(instructorId)

Get available lesson packages

Returns available lesson packages with pricing. AI should call this to present package options to students. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.PackagesApi();
let instructorId = "instructorId_example"; // String | Instructor ID to get their specific pricing
apiInstance.getPackages(instructorId, (error, data, response) => {
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
 **instructorId** | **String**| Instructor ID to get their specific pricing | 

### Return type

[**GetPackages200Response**](GetPackages200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

