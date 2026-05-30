# DriveBookVoiceServiceApi.CreateBookingRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**instructorId** | **String** | Instructor ID resolved from API responses. Use when you have the ID from GET /instructors/recommendations or GET /instructors/search. Either instructorId or instructorQuery must be provided.  | [optional] 
**instructorQuery** | **String** | Optional: instructor name or phone number. Use when you only have a name (e.g. \&quot;Debesay\&quot;) or phone number. Backend will resolve to an instructorId automatically. Either instructorId or instructorQuery must be provided. Examples: \&quot;Debesay\&quot;, \&quot;Debesay Birhane\&quot;, \&quot;0400123456\&quot;  | [optional] 
**packageType** | **String** |  | 
**hours** | **Number** | Required only for CUSTOM package | [optional] 
**includeTestPackage** | **Boolean** |  | [optional] [default to false]
**bookingType** | **String** | Schedule now or buy credits for later | 
**registrationType** | **String** |  | 
**accountHolderName** | **String** |  | 
**accountHolderEmail** | **String** |  | 
**accountHolderPhone** | **String** | Phone number - password will be auto-generated and sent via SMS/email | 
**learnerName** | **String** | Required if registrationType is someone-else | [optional] 
**learnerPhone** | **String** |  | [optional] 
**learnerRelationship** | **String** |  | [optional] 
**scheduledBookings** | [**[CreateBookingRequestScheduledBookingsInner]**](CreateBookingRequestScheduledBookingsInner.md) | Required if bookingType is now | [optional] 



## Enum: PackageTypeEnum


* `PACKAGE_6` (value: `"PACKAGE_6"`)

* `PACKAGE_10` (value: `"PACKAGE_10"`)

* `PACKAGE_15` (value: `"PACKAGE_15"`)

* `CUSTOM` (value: `"CUSTOM"`)





## Enum: BookingTypeEnum


* `now` (value: `"now"`)

* `later` (value: `"later"`)





## Enum: RegistrationTypeEnum


* `myself` (value: `"myself"`)

* `someone-else` (value: `"someone-else"`)





## Enum: LearnerRelationshipEnum


* `child` (value: `"child"`)

* `partner` (value: `"partner"`)

* `grandchild` (value: `"grandchild"`)

* `parent` (value: `"parent"`)

* `friend` (value: `"friend"`)

* `other` (value: `"other"`)




