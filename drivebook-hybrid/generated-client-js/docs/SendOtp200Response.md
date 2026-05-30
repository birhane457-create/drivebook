# DriveBookVoiceServiceApi.SendOtp200Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**verificationId** | **String** |  | [optional] 
**delivery** | **String** | delivery method used (sms|email) | [optional] 
**expiresIn** | **Number** | seconds until OTP expires (typically 300) | [optional] 
**maxAttempts** | **Number** | Maximum number of confirmation attempts allowed for this verification (typically 3) | [optional] 
**resendAfterSeconds** | **Number** | Seconds until a new OTP can be requested (typically 60) | [optional] 
**rateLimitPerHour** | **Number** | Number of OTP requests allowed per hour for the caller (typically 3) | [optional] 


