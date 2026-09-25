# VU23213 — Deep Dive: Every Term Explained with Real Steps

## Why networking matters for cyber security

Every attack travels through a network. If you don't understand how packets move, you can't understand how they're intercepted, spoofed, flooded, or manipulated. This unit is the foundation everything else is built on.

---

## TERM: IP Address

**What it is:** A unique numerical label assigned to every device on a network.

**Why you need to know it:** Every HTTP request your app receives comes from an IP address. Your rate limiter (`lib/ratelimit.ts`) uses IP to identify who is sending too many requests.

**Two versions:**
- IPv4: `192.168.1.100` — 32-bit, four numbers 0–255 separated by dots
- IPv6: `2001:0db8:85a3::8a2e:0370:7334` — 128-bit, eight groups of hex digits

**Real example from DriveBook:**
```
// From your Railway logs:
"upstreamAddress": "http://[fd12:edf3:d9c7:1:9000:5e:bedc:9f5e]:3001"
```
`fd12:edf3:...` is an IPv6 address. The `fd` prefix means it is a **Unique Local Address** — private, not routable on the public internet. Like `192.168.x.x` for IPv4.

**Step-by-step: how your app sees a client IP**
```
1. User in Perth opens drivebook.com.au in their browser
2. Their home router has public IP: 203.206.1.45
3. Browser sends HTTP request to Vercel
4. Vercel receives the request from IP 203.206.1.45
5. Vercel adds the header: X-Forwarded-For: 203.206.1.45
6. Your Next.js route handler reads: req.headers.get('x-forwarded-for')
7. Rate limiter uses "203.206.1.45" as the identifier
```

---

## TERM: Subnet / CIDR Notation

**What it is:** A way to describe a range of IP addresses using a base address and a number of bits.

**Why you need it:** Firewalls use CIDR to allow or block ranges. Security tools display subnets. You'll see it on every network diagram.

**Format:** `192.168.1.0/24`
- `192.168.1.0` = base address
- `/24` = first 24 bits are the network part (the last 8 bits can vary)
- This represents addresses `192.168.1.0` through `192.168.1.255` = 256 addresses

**Common examples:**
```
10.0.0.0/8      → 10.x.x.x — AWS VPC, large private networks
192.168.0.0/16  → 192.168.x.x — home/office networks
172.16.0.0/12   → 172.16–31.x.x — Docker internal networks
```

**Step-by-step: reading a firewall rule**
```
Rule: ALLOW TCP from 0.0.0.0/0 to port 443

0.0.0.0/0 means "any IP address"
/0 means zero bits fixed = all addresses match

Translation: "Allow any IP to connect on port 443 (HTTPS)"
This is correct — your public website must accept HTTPS from anywhere.
```

---

## TERM: TCP (Transmission Control Protocol)

**What it is:** A connection-oriented protocol that guarantees reliable, ordered delivery of data.

**Why you need it:** Every HTTP/HTTPS request uses TCP. Understanding TCP handshakes explains both how connections work AND how SYN flood attacks work.

**The 3-Way Handshake — step by step:**

```
Step 1: CLIENT → SERVER  [SYN]
   Client: "I want to connect. My sequence number starts at 1000."
   SYN = synchronise sequence numbers

Step 2: SERVER → CLIENT  [SYN-ACK]
   Server: "OK. I acknowledge your sequence 1001. My sequence starts at 5000."
   SYN-ACK = synchronise + acknowledge

Step 3: CLIENT → SERVER  [ACK]
   Client: "Got it. I acknowledge your sequence 5001. Connection established."

[TCP Connection open — HTTP request can now flow]
```

**Real consequence for DriveBook:**
Every browser request to `https://drivebook.com.au` first does this 3-way handshake. The TLS handshake (for HTTPS) happens on top of this. This is why the first request is slightly slower than subsequent ones.

**SYN Flood Attack — step by step:**
```
Attacker sends 100,000 SYN packets with fake source IPs.
Server allocates memory for each half-open connection.
Server sends 100,000 SYN-ACKs to fake IPs — no one answers.
Server's connection table fills up (default limit ~65,000 half-open).
Legitimate users' SYN packets are rejected — "Connection refused".
Site appears to be down.
```

**Defence — SYN Cookies:**
Instead of storing state, the server encodes the connection details IN the SYN-ACK itself as a cookie. Only when a legitimate client sends the final ACK (which includes the cookie) does the server allocate memory. Fake clients never send the ACK, so no memory is wasted.

---

## TERM: UDP (User Datagram Protocol)

**What it is:** A connectionless protocol — fire and forget. No handshake, no acknowledgement, no guaranteed delivery.

**Why it matters:** DNS uses UDP. Attackers exploit it for amplification attacks.

**UDP vs TCP comparison:**
```
TCP sends a package with tracking, signature required, guaranteed delivery.
UDP throws a postcard in the mailbox — might arrive, might not.
```

**DNS Amplification Attack — step by step:**
```
1. Attacker sends a small UDP DNS query (60 bytes) to a public DNS server
   - But they SPOOF the source IP to be the victim's IP
   - Query: "Give me all records for example.com" (ANY query = big response)

2. DNS server sends a large response (3,000 bytes) to the victim's IP
   - Amplification factor: 50x (60 bytes in → 3,000 bytes out)

3. Attacker controls 10,000 compromised devices (botnet)
   - Each sends 60 bytes → victim receives 3,000 bytes × 10,000 = 30 GB/s of traffic
   - Victim's bandwidth is saturated — service goes down
```

**Why DriveBook uses Vercel for DDoS protection:**
Vercel's edge network absorbs UDP-based and volumetric attacks before they reach your app servers.

---

## TERM: DNS (Domain Name System)

**What it is:** The internet's phone book. Translates human-readable names to IP addresses.

**Why it matters:** If DNS is compromised, users can be redirected to fake sites even if they type the correct URL.

**DNS Resolution — step by step:**
```
1. User types: drivebook.com.au
2. Browser checks its own cache — not found
3. Browser asks the OS DNS resolver — not found
4. OS asks the configured DNS server (e.g., Google's 8.8.8.8)
5. 8.8.8.8 asks the root nameserver: "Who handles .au?"
6. Root says: "Ask 203.x.x.x (the .au nameserver)"
7. .au nameserver says: "Ask 205.x.x.x (Vercel's nameserver for drivebook.com.au)"
8. Vercel's nameserver returns: 76.76.21.21 (Vercel edge IP)
9. Browser connects to 76.76.21.21 on port 443
```

**DNS Cache Poisoning — step by step:**
```
1. Attacker targets your ISP's DNS resolver
2. Attacker sends a flood of forged DNS responses for "drivebook.com.au"
3. One forged response arrives before the real one and gets cached
4. Cached entry: drivebook.com.au → 45.33.32.156 (attacker's IP)
5. All customers of that ISP now go to the fake site

PROTECTION: HTTPS + Certificate Pinning
Even if DNS redirects to the wrong IP, the fake server can't present
a valid TLS certificate for drivebook.com.au — the browser shows a warning.
```

**DNS Record Types:**
```
A     → Maps domain to IPv4    drivebook.com.au → 76.76.21.21
AAAA  → Maps domain to IPv6    drivebook.com.au → 2606:4700::dead:beef
MX    → Mail server            drivebook.com.au → mail via Google Workspace
CNAME → Alias                  www → drivebook.com.au
TXT   → Arbitrary text         SPF, DKIM records for email verification
```

---

## TERM: Port Numbers

**What they are:** Numbers 0–65535 that identify specific services on a host. Like apartment numbers in a building — the IP is the building, the port is the apartment.

**Why it matters:** Firewalls control traffic by port. Attackers scan for open ports.

**Key ports to memorise:**
```
20/21  FTP    — File Transfer (insecure — use SFTP/443 instead)
22     SSH    — Secure Shell (server access)
25     SMTP   — Email sending
53     DNS    — Domain Name System (both UDP and TCP)
80     HTTP   — Web (unencrypted)
443    HTTPS  — Web (encrypted with TLS)
3306   MySQL  — Database
5432   PostgreSQL — Database (Supabase uses this)
6379   Redis  — Cache/rate limiting
8080   HTTP alt — Dev servers often use this
3000   — Your Next.js dev server
3001   — Your hybrid service (Railway)
6543   — Supabase pgbouncer (connection pooler)
```

**Port Scanning — what an attacker does:**
```bash
# Attacker runs:
nmap -sV -p 1-65535 drivebook.com.au

# This sends a TCP SYN to every port
# Open ports respond with SYN-ACK
# Closed ports respond with RST (reset)

# What an attacker learns:
# 443/tcp  open  ssl/https
# 80/tcp   open  http (redirect to 443)
# Everything else: closed or filtered
```

**Why Vercel protects you here:**
Vercel only exposes ports 80 and 443 to the public. All other ports are firewalled. Your database (port 5432) is only accessible from Vercel's internal network. Port scanning drivebook.com.au shows only 80/443.

---

## TERM: Firewall Rules

**What they are:** Ordered lists of allow/deny decisions applied to network traffic.

**Why they matter:** First line of defence. Wrong rules = open doors.

**Rule structure:**
```
[Action] [Protocol] from [Source IP/range] to [Destination IP/range] on [Port]
```

**Real example — Supabase firewall:**
```
ALLOW TCP from 0.0.0.0/0  to 5432   ← WRONG — database open to internet!
ALLOW TCP from Vercel IPs  to 5432  ← RIGHT — only Vercel can connect
DENY  ALL  from 0.0.0.0/0           ← Default deny everything else
```

**Stateful vs stateless — practical difference:**

```
STATELESS FIREWALL:
Rule: ALLOW TCP from any to port 80 (inbound)
Problem: How does it handle the RESPONSE going back?
You'd need a separate rule: ALLOW TCP from port 80 to any (outbound)
But that also allows attackers to SEND from port 80, bypassing rules.

STATEFUL FIREWALL:
Rule: ALLOW TCP from any to port 80 (inbound)
The firewall creates a connection entry:
  { src: 203.206.1.45:52341, dst: 76.76.21.21:80, state: ESTABLISHED }
The return traffic is automatically allowed because it matches the connection.
Unsolicited traffic coming FROM port 80 is blocked — not in the table.
```

---

## TERM: TLS / HTTPS

**What it is:** Transport Layer Security. Encrypts data between client and server so no one in the middle can read it.

**Why it matters:** Without HTTPS, anyone on the same Wi-Fi network can read your users' login credentials, booking details, and payment data.

**TLS Handshake — step by step (simplified):**
```
1. CLIENT → SERVER: "ClientHello"
   "I support TLS 1.3, here are my cipher suites:
   TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256..."

2. SERVER → CLIENT: "ServerHello" + Certificate
   "I'll use TLS_AES_256_GCM_SHA384.
   Here is my certificate proving I am drivebook.com.au,
   signed by Let's Encrypt (a trusted Certificate Authority)"

3. CLIENT verifies the certificate:
   - Is it for the right domain? (drivebook.com.au ✓)
   - Is it signed by a CA my browser trusts? (Let's Encrypt ✓)
   - Is it expired? (No ✓)
   - Has it been revoked? (No ✓)

4. CLIENT generates a session key and encrypts it with the server's public key
   CLIENT → SERVER: [encrypted session key]
   
5. SERVER decrypts the session key with its private key
   Both now share the same AES-256 session key

6. All further traffic encrypted with AES-256
   Even if captured, unreadable without the session key
```

**Why certificate validation protects against DNS poisoning:**
```
Attacker poisons DNS → user's browser connects to 45.33.32.156 (fake server)
Browser checks certificate: "Are you drivebook.com.au?"
Fake server: "Yes, here's my certificate for evil.com" ← WRONG DOMAIN
Browser: "Certificate domain mismatch — BLOCKED"
User sees: "Your connection is not private" warning
```

---

## TERM: VPN (Virtual Private Network)

**What it is:** Creates an encrypted tunnel between two endpoints over an untrusted network.

**Why it matters:** Protects data in transit, hides the contents from ISPs and attackers.

**How it works — step by step:**
```
WITHOUT VPN:
Your laptop → (plaintext) → Coffee shop router → (plaintext) → drivebook.com.au

WITH VPN:
Your laptop → (encrypted tunnel) → VPN server → (encrypted HTTPS) → drivebook.com.au
Coffee shop router sees: [encrypted blob] — can't read it
```

**Types:**
```
1. Remote Access VPN
   Employee at home → encrypted tunnel → company network
   Used for: accessing internal tools, databases not exposed to internet

2. Site-to-Site VPN  
   Office Perth → encrypted tunnel → Office Sydney
   Used for: connecting two office networks securely

3. Split Tunneling
   Only company traffic goes through VPN
   Personal browsing goes direct
   Risk: malware on personal browsing can still reach company network
```

**For DriveBook relevance:**
Service-to-service communication between Railway and Vercel goes over the public internet. Adding a VPN tunnel (e.g., WireGuard) between them would prevent MITM attacks on that traffic. Currently mitigated by TLS on each request.

---

## TERM: ARP (Address Resolution Protocol)

**What it is:** Maps IP addresses to MAC addresses on a local network.

**Why it matters:** ARP has no authentication — it can be spoofed.

**ARP Spoofing Attack — step by step:**
```
Normal ARP:
Device asks: "Who has IP 192.168.1.1?" (broadcast)
Router replies: "I do — my MAC is AA:BB:CC:DD:EE:FF"
Device stores: 192.168.1.1 → AA:BB:CC:DD:EE:FF in ARP cache

ARP Spoofing:
Attacker sends unsolicited ARP reply:
"192.168.1.1 is at MY MAC address 11:22:33:44:55:66"
Victim's ARP cache is poisoned:
192.168.1.1 → 11:22:33:44:55:66 (attacker's MAC)
All traffic destined for the router goes to the attacker first.
Attacker can read, modify, or drop traffic = Man-in-the-Middle.

PROTECTION: Dynamic ARP Inspection (DAI) on managed switches
Only works on local networks — not relevant for cloud-hosted apps like DriveBook.
```

---

## Summary: Network Security Stack for DriveBook

```
LAYER 7 (Application)
  ├── Input validation (Zod schemas)
  ├── Authentication (NextAuth JWT cookies)
  ├── Authorisation (role checks per route)
  ├── Rate limiting (Upstash Redis sliding window)
  └── Stripe webhook signature verification

LAYER 4 (Transport)
  └── TLS 1.3 (enforced by Vercel)
      Prevents: MITM, eavesdropping, credential theft

LAYER 3 (Network)
  └── Vercel DDoS protection
      Prevents: IP flood, amplification attacks
      X-Forwarded-For sanitised by Vercel edge

LAYER 2 (Data Link) — not applicable (cloud hosted)
LAYER 1 (Physical) — not applicable (cloud hosted)
```

The assessor will ask you to draw this. Practice explaining it from bottom to top:
"Physical bits travel up through layers. At each layer, headers are added (encapsulation going down) or removed (decapsulation going up). Attacks target the weakest layer. For DriveBook, layers 1–2 are handled by cloud providers; I focus security on layers 3–7."
