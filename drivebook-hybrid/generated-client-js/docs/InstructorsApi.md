# DriveBookVoiceServiceApi.InstructorsApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getInstructorRecommendations**](InstructorsApi.md#getInstructorRecommendations) | **GET** /instructors/recommendations | Get smart instructor recommendations (AI-POWERED)
[**searchInstructorsByLocation**](InstructorsApi.md#searchInstructorsByLocation) | **GET** /instructors/search | Search instructors by location or name (PRIMARY ENDPOINT)



## getInstructorRecommendations

> GetInstructorRecommendations200Response getInstructorRecommendations(location, opts)

Get smart instructor recommendations (AI-POWERED)

Returns top instructors ranked by intelligent scoring algorithm. Considers rating, distance, price, and experience. This is the BEST endpoint for AI to use - provides pre-ranked, personalized results. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.InstructorsApi();
let location = "location_example"; // String | Pickup location (e.g. Joondalup WA)
let opts = {
  'vehicleType': "vehicleType_example", // String | Preferred vehicle type
  'language': "language_example", // String | Preferred language (e.g. English)
  'budget': 3.4, // Number | Maximum hourly rate (e.g. 75)
  'experienceLevel': "experienceLevel_example", // String | 
  'limit': 3 // Number | Number of recommendations to return (default: 3)
};
apiInstance.getInstructorRecommendations(location, opts, (error, data, response) => {
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
 **location** | **String**| Pickup location (e.g. Joondalup WA) | 
 **vehicleType** | **String**| Preferred vehicle type | [optional] 
 **language** | **String**| Preferred language (e.g. English) | [optional] 
 **budget** | **Number**| Maximum hourly rate (e.g. 75) | [optional] 
 **experienceLevel** | **String**|  | [optional] 
 **limit** | **Number**| Number of recommendations to return (default: 3) | [optional] [default to 3]

### Return type

[**GetInstructorRecommendations200Response**](GetInstructorRecommendations200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## searchInstructorsByLocation

> SearchInstructorsByLocation200Response searchInstructorsByLocation(location)

Search instructors by location or name (PRIMARY ENDPOINT)

Find instructors who serve a specific location, sorted by distance and rating. This is the MAIN endpoint for the AI to use when a student provides their pickup location. Also supports ?name&#x3D; for finding a specific instructor by name. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.InstructorsApi();
let location = "location_example"; // String | Pickup location - address, suburb, or postcode (e.g. Joondalup WA)
apiInstance.searchInstructorsByLocation(location, (error, data, response) => {
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
 **location** | **String**| Pickup location - address, suburb, or postcode (e.g. Joondalup WA) | 

### Return type

[**SearchInstructorsByLocation200Response**](SearchInstructorsByLocation200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

