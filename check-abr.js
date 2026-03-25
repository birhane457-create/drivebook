/**
 * Direct ABR API test — dumps raw XML response so we can verify tag names
 * Usage: node check-abr.js [abn]
 * Default ABN: 70776987882 (NATNAEL WELDEGEBRIEL BIRHANE)
 */

const ABR_GUID = 'a3a72990-08b2-4ed8-b7f1-8b385339c9b7';
const ABR_URL = 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/SearchByABNv202001';

const abn = process.argv[2] || '70776987882';

function extractXml(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
  return match?.[1]?.trim() || null;
}

async function checkAbr() {
  console.log(`\n🔍 Checking ABN: ${abn}\n`);

  const url = `${ABR_URL}?searchString=${abn}&includeHistoricalDetails=N&authenticationGuid=${ABR_GUID}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DriveBook/1.0 (contact@drivebook.com.au)' },
    });

    console.log(`HTTP status: ${res.status}`);

    const xml = await res.text();

    console.log('\n📄 RAW XML RESPONSE:');
    console.log('─'.repeat(80));
    console.log(xml);
    console.log('─'.repeat(80));

    // Test all the tag names we care about
    console.log('\n🔎 TAG EXTRACTION RESULTS:');
    const tags = [
      'abnStatus',           // old (wrong) tag
      'entityStatusCode',    // new (correct?) tag
      'ABNStatusCode',       // alternative
      'organisationName',
      'givenName',
      'familyName',
      'goodsAndServicesTax',
      'effectiveFrom',
      'entityTypeCode',
      'entityTypeInd',
      'stateCode',
      'postcode',
    ];

    for (const tag of tags) {
      const val = extractXml(xml, tag);
      console.log(`  <${tag}>: ${val !== null ? `"${val}"` : '(not found)'}`);
    }

    // GST detection
    const gstPresent = xml.includes('<goodsAndServicesTax>');
    const gstSelfClosing = xml.includes('<goodsAndServicesTax/>') || xml.includes('<goodsAndServicesTax />');
    console.log(`\n  GST element present: ${gstPresent}`);
    console.log(`  GST self-closing: ${gstSelfClosing}`);
    console.log(`  GST registered (derived): ${gstPresent && !gstSelfClosing}`);

    // Summary
    const entityStatusCode = extractXml(xml, 'entityStatusCode');
    const abnStatusOld = extractXml(xml, 'abnStatus');
    const givenName = extractXml(xml, 'givenName');
    const familyName = extractXml(xml, 'familyName');
    const orgName = extractXml(xml, 'organisationName');
    const entityName = orgName ?? ([givenName, familyName].filter(Boolean).join(' ') || null);

    console.log('\n✅ SUMMARY:');
    console.log(`  entityStatusCode: ${entityStatusCode}`);
    console.log(`  abnStatus (old tag): ${abnStatusOld}`);
    console.log(`  isActive (new): ${entityStatusCode === 'Active'}`);
    console.log(`  isActive (old): ${abnStatusOld === 'Active'}`);
    console.log(`  entityName: ${entityName}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkAbr();
