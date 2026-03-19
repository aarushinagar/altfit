#!/usr/bin/env ts-node
/**
 * Test script for new email types: good-morning and share-outfits
 * Requires: CRON_SECRET env var (from Render dashboard or .env.local)
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';

interface EmailResult {
  sent: number;
  failed: number;
  total: number;
  results: Array<{
    userId: string;
    email: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

async function testGoodMorningEmail(): Promise<void> {
  console.log('\n🌅 Testing Good Morning Email...\n');

  try {
    const response = await axios.post<EmailResult>(
      `${BASE_URL}/api/emails/good-morning`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const { sent, failed, total, results } = response.data;
    console.log(`✅ Good Morning Email Results:`);
    console.log(`   Total: ${total} | Sent: ${sent} | Failed: ${failed}`);
    
    if (results.length > 0) {
      console.log(`\n   Details:`);
      results.slice(0, 3).forEach((r) => {
        console.log(`   • ${r.email}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
      });
      if (results.length > 3) {
        console.log(`   ... and ${results.length - 3} more`);
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Good Morning Email Error: ${error.response?.status}`);
      console.error(`   ${error.response?.data?.error || error.message}`);
    } else {
      console.error(`❌ Good Morning Email Error:`, error);
    }
  }
}

async function testShareOutfitsEmail(): Promise<void> {
  console.log('\n💚 Testing Share Your Outfits Email...\n');

  try {
    const response = await axios.post<EmailResult>(
      `${BASE_URL}/api/emails/share-outfits`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const { sent, failed, total, results } = response.data;
    console.log(`✅ Share Your Outfits Email Results:`);
    console.log(`   Total: ${total} | Sent: ${sent} | Failed: ${failed}`);
    
    if (results.length > 0) {
      console.log(`\n   Details:`);
      results.slice(0, 3).forEach((r) => {
        console.log(`   • ${r.email}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
      });
      if (results.length > 3) {
        console.log(`   ... and ${results.length - 3} more`);
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Share Your Outfits Email Error: ${error.response?.status}`);
      console.error(`   ${error.response?.data?.error || error.message}`);
    } else {
      console.error(`❌ Share Your Outfits Email Error:`, error);
    }
  }
}

async function main(): Promise<void> {
  console.log('📧 Email System Test Suite\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`CRON_SECRET: ${CRON_SECRET ? '***' : 'NOT SET'}\n`);

  await testGoodMorningEmail();
  await testShareOutfitsEmail();

  console.log('\n✅ Test suite complete\n');
}

main().catch(console.error);
