# Notes — Operating Systems

## Core concepts

### Users, groups and privilege
A user identity determines who is requesting an action. Groups simplify permission management. Privileged accounts can perform operations ordinary accounts cannot.

### Files and permissions
On Linux, permissions are commonly expressed for owner, group and others. Read, write and execute have different security consequences depending on the object.

### Processes and services
A process is a running program instance. A service is a managed background workload. Security investigation asks what is running, why it is running, which identity owns it, and what network or filesystem access it has.

### Logs
Logs provide evidence about authentication, process/service activity and application events. A timestamp alone is not proof of causation; correlate multiple sources.

### Windows investigation
Windows Event Logs provide structured security and system telemetry. PowerShell can query and filter this data.

## Security questions
- Which identities can modify security-sensitive files?
- Which services run with elevated privileges?
- Which logs would show an authentication anomaly?
- What evidence distinguishes a failed login from successful compromise?

## DriveBook mapping
Study the deployment/runtime boundary rather than treating the application repository as an operating system. Identify where application processes run, which service owns them, what logs exist, and which provider controls the host.