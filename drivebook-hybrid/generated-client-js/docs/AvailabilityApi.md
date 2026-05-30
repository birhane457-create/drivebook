# DriveBookVoiceServiceApi.AvailabilityApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**checkAvailability**](AvailabilityApi.md#checkAvailability) | **POST** /availability | Check availability (general)
[**getAvailableSlots**](AvailabilityApi.md#getAvailableSlots) | **GET** /availability/slots | Get available time slots



## checkAvailability

> CheckAvailability200Response checkAvailability(instructorId, date, duration, opts)

Check availability (general)

General availability check endpoint proxied to main app.

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.AvailabilityApi();
let instructorId = "instructorId_example"; // String | 
let date = new Date("2013-10-20"); // Date | Date in YYYY-MM-DD format (e.g. 2026-03-25)
let duration = 56; // Number | Lesson duration in minutes: 60, 90, or 120
let opts = {
  'body': {key: null} // Object | 
};
apiInstance.checkAvailability(instructorId, date, duration, opts, (error, data, response) => {
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
 **instructorId** | **String**|  | 
 **date** | **Date**| Date in YYYY-MM-DD format (e.g. 2026-03-25) | 
 **duration** | **Number**| Lesson duration in minutes: 60, 90, or 120 | 
 **body** | **Object**|  | [optional] 

### Return type

[**CheckAvailability200Response**](CheckAvailability200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## getAvailableSlots

> AvailabilityResponse getAvailableSlots(instructorId, date, opts)

Get available time slots

Returns available booking slots for an instructor on a specific date

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.AvailabilityApi();
let instructorId = "instructorId_example"; // String | Instructor ID to get slots for
let date = new Date("2013-10-20"); // Date | Date in YYYY-MM-DD format (e.g. 2026-03-25)
let opts = {
  'duration': 56 // Number | Lesson duration in minutes (e.g. 60)
};
apiInstance.getAvailableSlots(instructorId, date, opts, (error, data, response) => {
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
 **instructorId** | **String**| Instructor ID to get slots for | 
 **date** | **Date**| Date in YYYY-MM-DD format (e.g. 2026-03-25) | 
 **duration** | **Number**| Lesson duration in minutes (e.g. 60) | [optional] 

### Return type

[**AvailabilityResponse**](AvailabilityResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

