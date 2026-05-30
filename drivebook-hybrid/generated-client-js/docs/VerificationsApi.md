# DriveBookVoiceServiceApi.VerificationsApi

All URIs are relative to *https://drivebook.com.au/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**confirmOtp**](VerificationsApi.md#confirmOtp) | **POST** /verifications/otp/confirm | Confirm OTP and issue verification token
[**sendOtp**](VerificationsApi.md#sendOtp) | **POST** /verifications/otp | Send OTP for identity verification



## confirmOtp

> ConfirmOtp200Response confirmOtp(body)

Confirm OTP and issue verification token

Confirm the one-time PIN sent to the user. On success returns a short-lived &#x60;verificationToken&#x60; which clients must present when performing sensitive actions like cancelling or rescheduling a booking. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.VerificationsApi();
let body = new DriveBookVoiceServiceApi.ConfirmOtpRequest(); // ConfirmOtpRequest | 
apiInstance.confirmOtp(body, (error, data, response) => {
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
 **body** | [**ConfirmOtpRequest**](ConfirmOtpRequest.md)|  | 

### Return type

[**ConfirmOtp200Response**](ConfirmOtp200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## sendOtp

> SendOtp200Response sendOtp(body)

Send OTP for identity verification

Generate and send a one-time PIN (OTP) to the provided phone or email for actions that require identity verification (reschedule, cancel). Returns a short-lived &#x60;verificationId&#x60; used to confirm the OTP. Codes expire after 5 minutes, allow up to 3 failed confirmation attempts, require a 60-second resend delay, and are rate-limited to 3 requests per hour. 

### Example

```javascript
import DriveBookVoiceServiceApi from 'drive_book_voice_service_api';

let apiInstance = new DriveBookVoiceServiceApi.VerificationsApi();
let body = new DriveBookVoiceServiceApi.SendOtpRequest(); // SendOtpRequest | 
apiInstance.sendOtp(body, (error, data, response) => {
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
 **body** | [**SendOtpRequest**](SendOtpRequest.md)|  | 

### Return type

[**SendOtp200Response**](SendOtp200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

