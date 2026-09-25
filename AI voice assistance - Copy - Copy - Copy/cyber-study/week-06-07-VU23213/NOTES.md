# Weeks 6–7 — VU23213: Network Concepts and Protocols for Cyber Security

## Why this week matters for you specifically

Your your assessor will question you here because your Challenge 2 showed you know
rate limiting and auth but have gaps in formal networking theory. This week closes that.

---

## 1. The OSI Model (7 Layers)

Think of it as the layers a network packet travels through, from cable to application.

| Layer | Number | Name | What it does | Protocol examples |
|-------|--------|------|--------------|-------------------|
| Application | 7 | Application | User-facing services | HTTP, HTTPS, DNS, FTP, SMTP |
| Presentation | 6 | Presentation | Data format, encryption | TLS/SSL, JPEG, ASCII |
| Session | 5 | Session | Manages connections | NetBIOS, RPC |
| Transport | 4 | Transport | End-to-end delivery, ports | TCP, UDP |
| Network | 3 | Network | IP addressing, routing | IP, ICMP, ARP |
| Data Link | 2 | Data Link | MAC addresses, frames | Ethernet, Wi-Fi (802.11) |
| Physical | 1 | Physical | Cables, signals | Fibre, copper, radio |

**Memory trick:** "All People Seem To Need Data Processing" (top to bottom)

**For security:** most attacks happen at:
- Layer 3 (IP spoofing, DDoS)
- Layer 4 (SYN flood, port scanning)
- Layer 7 (SQL injection, XSS, CSRF — application-layer attacks)

---

## 2. TCP vs UDP

| | TCP | UDP |
|-|-----|-----|
| Connection | Yes (3-way handshake) | No (fire and forget) |
| Reliability | Guaranteed delivery, ordered | Best effort, no guarantee |
| Speed | Slower | Faster |
| Use cases | HTTP, email, databases | DNS queries, video streaming, VoIP |
| Attack risk | SYN flood (half-open connections exhaust server) | UDP flood (amplification DDoS) |

### TCP 3-way handshake
```
Client → SYN → Server
Client ← SYN-ACK ← Server
Client → ACK → Server
[Connection established]
```
A **SYN flood attack** sends thousands of SYN packets but never sends the final ACK,
leaving the server with thousands of half-open connections that exhaust its memory.

---

## 3. IP Addressing

### IPv4
- Format: 4 octets, e.g., `192.168.1.100`
- Range: 0.0.0.0 to 255.255.255.255 (~4.3 billion addresses)
- **Private ranges** (not routable on the internet):
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`

### Subnet mask
Tells the network which part of an IP is the network and which is the host.
- `255.255.255.0` = `/24` = 256 addresses, 254 usable hosts
- `255.255.0.0` = `/16` = 65,536 addresses

### IPv6
- Format: 8 groups of 4 hex digits, e.g., `2001:0db8:85a3:0000:0000:8a2e:0370:7334`
- 128-bit address space — virtually unlimited
- DriveBook relevance: Railway uses IPv6 internally (you saw `fd12:edf3:d9c7:1:...` in logs)

---

## 4. Key Protocols

### DNS (Domain Name System) — Port 53
Translates domain names to IP addresses.
- `drivebook.com.au` → DNS lookup → `76.76.21.21` (Vercel IP)
- **DNS poisoning attack**: attacker corrupts DNS cache to redirect your domain to their server

### DHCP (Dynamic Host Configuration Protocol) — Ports 67/68
Automatically assigns IP addresses to devices on a network.
- **DHCP starvation attack**: attacker requests all available IPs, denying service to real devices
- **Rogue DHCP server**: attacker sets up fake DHCP server, points clients to malicious DNS/gateway

### HTTP vs HTTPS
- HTTP (port 80): plaintext — anyone on the network can read it
- HTTPS (port 443): encrypted with TLS — traffic is encrypted end-to-end

### SMTP / POP3 / IMAP (Email)
- SMTP (25/587): sending email
- POP3 (110): downloading email
- IMAP (143/993): syncing email across devices
- Attacks: email spoofing, phishing, SMTP relay abuse

---

## 5. Firewalls

### What a firewall does
Inspects network traffic and allows or blocks it based on rules (rule set / ACL).

### Types
| Type | How it works |
|------|-------------|
| **Packet filter** | Checks source/dest IP and port. Fast but basic — no context. |
| **Stateful firewall** | Tracks connection state. Knows a packet is part of an established TCP session vs a new attack packet. Blocks packets that don't belong to an established session. |
| **Application layer (WAF)** | Inspects HTTP content. Can block SQL injection, XSS, malicious payloads. |

**Stateful firewall example:** 
If your server sends a SYN-ACK to a client, a stateful firewall knows to expect the final ACK.
If instead it receives a RST (reset) from an unknown source, it blocks it — that packet has no matching connection state.

### Firewall rules order
Rules are evaluated top-to-bottom. First match wins.
```
ALLOW TCP from 192.168.1.0/24 to port 443
ALLOW TCP from any to port 80
DENY all
```

---

## 6. VPNs (Virtual Private Networks)

Creates an encrypted tunnel between two endpoints over an untrusted network (like the internet).

- **Site-to-site VPN**: connects two offices
- **Remote access VPN**: employee connects to office network from home
- **Protocols**: IPSec, OpenVPN, WireGuard

**For DriveBook**: your Railway service communicates with Vercel over the public internet.
In a higher-security context, you'd add a VPN tunnel between them.

---

## 7. Common Network Attacks

| Attack | Layer | What happens | Defence |
|--------|-------|--------------|---------|
| SYN flood | 4 | Half-open TCP connections exhaust server | SYN cookies, rate limiting |
| DDoS | 3–4 | Traffic flood from many sources | Cloudflare DDoS protection, rate limiting |
| DNS poisoning | 7 | Corrupt DNS cache redirects traffic | DNSSEC |
| ARP spoofing | 2 | Attacker maps their MAC to another IP | Dynamic ARP inspection |
| Man-in-the-middle | 3–7 | Intercepts traffic between two parties | HTTPS, certificate pinning |
| Port scanning | 4 | Probing which ports are open | Hide services, firewall, fail2ban |

---

## Practice Questions

**Q1:** A user reports they typed drivebook.com.au but arrived at a fake site asking for their password. What attack most likely occurred and how does it work?

**Model answer:** DNS cache poisoning. An attacker corrupted a DNS resolver's cache entry for drivebook.com.au so it returned a malicious IP address instead of the real one. When the user's browser did the DNS lookup, it received the fake IP and connected to the attacker's server. Defence: DNSSEC (digitally signed DNS records) and HTTPS certificate verification (the fake site can't have a valid certificate for drivebook.com.au).

**Q2:** Explain the difference between a stateless packet filter and a stateful firewall. Which is more secure and why?

**Model answer:** A stateless packet filter checks each packet in isolation — source IP, destination IP, port number. It doesn't know if a packet belongs to an existing connection. A stateful firewall maintains a connection table and checks whether each packet matches an established, expected session. It's more secure because it can block packets that have the right IP/port but don't belong to any active connection — preventing attacks like spoofed ACK packets that try to hijack sessions.
