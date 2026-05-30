# DriveBookVoiceServiceApi.SendOtpRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**purpose** | **String** | Purpose for verification; used for auditing and expiry. | 
**phone** | **String** | Phone number to send SMS OTP to | [optional] 
**email** | **String** | Email to send OTP to (alternative to phone) | [optional] 
**ttlSeconds** | **Number** | Optional desired TTL for the OTP in seconds (backend may enforce limits) | [optional] 



## Enum: PurposeEnum


* `reschedule` (value: `"reschedule"`)

* `cancel` (value: `"cancel"`)

* `login` (value: `"login"`)




