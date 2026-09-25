# Notes — Networking

## Core concepts
- **ARP:** resolves IPv4 addresses to local-link MAC addresses.
- **DHCP:** commonly provides IP configuration dynamically.
- **NAT:** translates address/port information between network contexts.
- **Routing:** selects paths between networks.
- **VLAN:** logically separates Layer 2 broadcast domains.
- **Socket:** endpoint identified by transport protocol and address/port information.
- **DNS:** resolves names to records; integrity and resolver security matter.
- **HTTP:** application protocol carrying requests/responses.
- **TLS:** provides encrypted transport plus endpoint authentication when certificate validation succeeds.

## Investigation principle
Do not infer an attack from one packet. Establish baseline behavior, identify the protocol, correlate timestamps and inspect multiple indicators.

## DriveBook mapping
Map browser → application/API → database/external service flows. Identify trust boundaries and which traffic should be encrypted, authenticated, logged or segmented.