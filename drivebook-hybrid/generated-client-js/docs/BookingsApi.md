# DriveBookVoiceServiceApi.BookingsApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**cancelBooking**](BookingsApi.md#cancelBooking) | **POST** /public/bookings/{id}/cancel | Cancel a booking (requires verification)
[**createBooking**](BookingsApi.md#createBooking) | **POST** /public/bookings/bulk | Create booking with package
[**lookupBookings**](BookingsApi.md#lookupBookings) | **GET** /bookings/lookup | Look up bookings by phone number
[**rescheduleBooking**](BookingsApi.md#rescheduleBooking) | **POST** /public/bookings/{id}/reschedule | Reschedule a booking (requires verification)



## cancelBooking

> CancelBooking200Response cancelBooking(id, xVerificationToken, opts)

Cancel a booking (requires verification)

Cancel a booking after verifying the requestor&#39;s identity via the &#x60;X-Verification-Token&#x60; header (OTP confirmation).

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';
let defaultClient = DriveBookVoiceServiceApi.ApiClient.instance;
// Configure API key authorization: BearerAuth
let BearerAuth = defaultClient.authentications['BearerAuth'];
BearerAuth.apiKey = 'YOUR API KEY';
// Uncomment the following line to set a prefix for the API key, e.g. "Token" (defaults to null)
//BearerAuth.apiKeyPrefix = 'Token';

let apiInstance = new DriveBookVoiceServiceApi.BookingsApi();
let id = "id_example"; // String | 
let xVerificationToken = "xVerificationToken_example"; // String | Short-lived verification token from OTP confirmation
let opts = {
  'idempotencyKey': "idempotencyKey_example", // String | Idempotency key for safely retrying cancel requests
  'body': new DriveBookVoiceServiceApi.CancelBookingRequest() // CancelBookingRequest | 
};
apiInstance.cancelBooking(id, xVerificationToken, opts, (error, data, response) => {
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
 **id** | **String**|  | 
 **xVerificationToken** | **String**| Short-lived verification token from OTP confirmation | 
 **idempotencyKey** | **String**| Idempotency key for safely retrying cancel requests | [optional] 
 **body** | [**CancelBookingRequest**](CancelBookingRequest.md)|  | [optional] 

### Return type

[**CancelBooking200Response**](CancelBooking200Response.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## createBooking

> CreateBooking200Response createBooking(body, opts)

Create booking with package

Create a new booking or package purchase. IMPORTANT: Backend calculates pricing - AI should NOT send pricing fields. AI only sends: instructor, package type, schedule, and account details.  INSTRUCTOR RESOLUTION: Either &#x60;instructorId&#x60; or &#x60;instructorQuery&#x60; must be provided. - &#x60;instructorId&#x60;: use when you already have the ID from a previous search/recommendations call - &#x60;instructorQuery&#x60;: use when you only have a name or phone — backend resolves to an ID AI should NEVER ask the caller for an instructor ID directly.  NOTE: Although this path is under &#x60;/public&#x60;, this endpoint requires Bearer authentication and is intended for trusted service-to-service calls from the hybrid voice service to the main DriveBook API. Present a valid &#x60;Authorization: Bearer &lt;token&gt;&#x60;.  CONDITIONAL VALIDATION (documented): - Either &#x60;instructorId&#x60; or &#x60;instructorQuery&#x60; must be present. - If &#x60;packageType&#x60; is &#x60;CUSTOM&#x60;, &#x60;hours&#x60; is required. - If &#x60;bookingType&#x60; is &#x60;now&#x60;, &#x60;scheduledBookings&#x60; must be supplied and each entry must include &#x60;date&#x60;, &#x60;time&#x60;, &#x60;duration&#x60;, and &#x60;pickupLocation&#x60;. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';
let defaultClient = DriveBookVoiceServiceApi.ApiClient.instance;
// Configure API key authorization: BearerAuth
let BearerAuth = defaultClient.authentications['BearerAuth'];
BearerAuth.apiKey = 'YOUR API KEY';
// Uncomment the following line to set a prefix for the API key, e.g. "Token" (defaults to null)
//BearerAuth.apiKeyPrefix = 'Token';

let apiInstance = new DriveBookVoiceServiceApi.BookingsApi();
let body = new DriveBookVoiceServiceApi.CreateBookingRequest(); // CreateBookingRequest | 
let opts = {
  'idempotencyKey': "idempotencyKey_example" // String | Idempotency key for safely retrying create booking requests
};
apiInstance.createBooking(body, opts, (error, data, response) => {
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
 **body** | [**CreateBookingRequest**](CreateBookingRequest.md)|  | 
 **idempotencyKey** | **String**| Idempotency key for safely retrying create booking requests | [optional] 

### Return type

[**CreateBooking200Response**](CreateBooking200Response.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## lookupBookings

> LookupBookings200Response lookupBookings(phone)

Look up bookings by phone number

Find existing bookings when the user provides a phone number. Used for reschedule/cancel flows.

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.BookingsApi();
let phone = "phone_example"; // String | Phone number used on the booking (E.164 recommended)
apiInstance.lookupBookings(phone, (error, data, response) => {
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
 **phone** | **String**| Phone number used on the booking (E.164 recommended) | 

### Return type

[**LookupBookings200Response**](LookupBookings200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## rescheduleBooking

> RescheduleBooking200Response rescheduleBooking(id, xVerificationToken, body, opts)

Reschedule a booking (requires verification)

Reschedule a booking after verifying the requestor&#39;s identity via the &#x60;X-Verification-Token&#x60; header (OTP confirmation).

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';
let defaultClient = DriveBookVoiceServiceApi.ApiClient.instance;
// Configure API key authorization: BearerAuth
let BearerAuth = defaultClient.authentications['BearerAuth'];
BearerAuth.apiKey = 'YOUR API KEY';
// Uncomment the following line to set a prefix for the API key, e.g. "Token" (defaults to null)
//BearerAuth.apiKeyPrefix = 'Token';

let apiInstance = new DriveBookVoiceServiceApi.BookingsApi();
let id = "id_example"; // String | 
let xVerificationToken = "xVerificationToken_example"; // String | Short-lived verification token from OTP confirmation
let body = new DriveBookVoiceServiceApi.RescheduleBookingRequest(); // RescheduleBookingRequest | 
let opts = {
  'idempotencyKey': "idempotencyKey_example" // String | Idempotency key for safely retrying reschedule requests
};
apiInstance.rescheduleBooking(id, xVerificationToken, body, opts, (error, data, response) => {
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
 **id** | **String**|  | 
 **xVerificationToken** | **String**| Short-lived verification token from OTP confirmation | 
 **body** | [**RescheduleBookingRequest**](RescheduleBookingRequest.md)|  | 
 **idempotencyKey** | **String**| Idempotency key for safely retrying reschedule requests | [optional] 

### Return type

[**RescheduleBooking200Response**](RescheduleBooking200Response.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

