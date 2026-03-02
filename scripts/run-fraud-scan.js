/**
 * RUN FRAUD DETECTION SCAN
 * 
 * Runs comprehensive fraud detection checks:
 * - Same card across multiple accounts
 * - Instructor self-booking patterns
 * - Refund-rebook abuse
 * - Velocity anomalies
 * - Instructor risk scoring
 * 
 * Usage: node scripts/run-fraud-scan.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import fraud detection service
async function runFraudScan() {
  console.log('🔍 FRAUD DETECTION SCAN');
  console.log('========================\n');

  try {
    // Import the fraud detection module
    const { runFraudScan } = require('../lib/services/fraudDetection');

    // Run the scan
    const results = await runFraudScan();

    // Display results
    console.log('\n📊 SCAN RESULTS');
    console.log('========================');
    console.log('Timestamp:', results.timestamp);
    console.log('\nALERTS:');
    console.log('- Total:', results.summary.totalAlerts);
    console.log('- High Severity:', results.summary.highSeverity);
    console.log('- Medium Severity:', results.summary.mediumSeverity);
    console.log('- Low Severity:', results.summary.lowSeverity);
    
    console.log('\nRISK SCORES:');
    console.log('- High Risk Instructors:', results.summary.highRiskInstructors);
    console.log('- Medium Risk Instructors:', results.summary.mediumRiskInstructors);

    // Display high-severity alerts
    if (results.summary.highSeverity > 0) {
      console.log('\n🚨 HIGH SEVERITY ALERTS:');
      console.log('========================');
      
      const highAlerts = results.alerts.filter(a => a.severity === 'HIGH');
      highAlerts.forEach((alert, index) => {
        console.log(`\n${index + 1}. ${alert.type}`);
        console.log(`   Description: ${alert.description}`);
        console.log(`   Entity: ${alert.entityType} ${alert.entityId}`);
        console.log(`   Action: ${alert.recommendedAction}`);
      });
    }

    // Display high-risk instructors
    if (results.summary.highRiskInstructors > 0) {
      console.log('\n🚨 HIGH RISK INSTRUCTORS:');
      console.log('========================');
      
      const highRisk = results.riskScores.filter(s => s.level === 'HIGH');
      highRisk.forEach((score, index) => {
        console.log(`\n${index + 1}. ${score.instructorName} (ID: ${score.instructorId})`);
        console.log(`   Risk Score: ${score.score}/100`);
        console.log(`   Factors:`);
        console.log(`   - Cancellation Rate: ${score.factors.cancellationRate}%`);
        console.log(`   - Dispute Rate: ${score.factors.disputeRate}%`);
        console.log(`   - Refund Frequency: ${score.factors.refundFrequency}%`);
        console.log(`   - Complaints: ${score.factors.complaintCount}`);
        console.log(`   Action: ${score.recommendedAction}`);
      });
    }

    // Display medium-risk instructors (top 5)
    if (results.summary.mediumRiskInstructors > 0) {
      console.log('\n⚠️ MEDIUM RISK INSTRUCTORS (Top 5):');
      console.log('========================');
      
      const mediumRisk = results.riskScores
        .filter(s => s.level === 'MEDIUM')
        .slice(0, 5);
      
      mediumRisk.forEach((score, index) => {
        console.log(`\n${index + 1}. ${score.instructorName}`);
        console.log(`   Risk Score: ${score.score}/100`);
        console.log(`   Action: ${score.recommendedAction}`);
      });
    }

    console.log('\n✅ Fraud scan complete');
    console.log('Results saved to audit log');

  } catch (error) {
    console.error('❌ Error running fraud scan:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFraudScan();
