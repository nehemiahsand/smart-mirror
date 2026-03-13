/**
 * Google Calendar Authorization Script
 * Run this to authorize your smart mirror to access Google Calendar
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const CREDENTIALS_PATH = path.join(__dirname, 'data/calendar-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'data/calendar-token.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

async function authorize() {
  try {
    // Load credentials
    const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(credentialsContent);

    if (!credentials.installed) {
      console.error('❌ Invalid credentials format. Expected "installed" OAuth client.');
      process.exit(1);
    }

    const { client_id, client_secret, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Generate auth URL
    const state = crypto.randomBytes(24).toString('hex');
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
    });

    console.log('\n📅 Google Calendar Authorization');
    console.log('================================\n');
    console.log('1️⃣  Open this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n2️⃣  Sign in with your Google account');
    console.log('3️⃣  Grant calendar permissions');
    console.log('4️⃣  After authorizing, you\'ll see a blank page or error page');
    console.log('5️⃣  Copy the ENTIRE URL from the browser address bar\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Paste the full URL here: ', async (fullUrl) => {
      rl.close();

      try {
        // Extract code from URL
        const url = new URL(fullUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code) {
          console.error('\n❌ No authorization code found in URL');
          console.error('Make sure you copied the complete URL from the browser');
          process.exit(1);
        }

        if (returnedState !== state) {
          console.error('\n❌ OAuth state mismatch');
          console.error('The authorization response did not match the request that was started.');
          process.exit(1);
        }

        console.log('\n⏳ Exchanging authorization code for tokens...');

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save token
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        console.log('\n✅ Authorization successful!');
        console.log(`📄 Token saved to: ${TOKEN_PATH}`);
        
        // Test the calendar access
        console.log('\n🧪 Testing calendar access...');
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date().toISOString(),
          maxResults: 5,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items || [];
        console.log(`\n✅ Found ${events.length} upcoming events`);
        
        if (events.length > 0) {
          console.log('\n📋 Next few events:');
          events.forEach((event, i) => {
            const start = event.start.dateTime || event.start.date;
            console.log(`  ${i + 1}. ${event.summary} - ${start}`);
          });
        }

        console.log('\n✨ Calendar widget is now ready!');
        console.log('🔄 Restart the backend: sudo docker compose restart backend\n');

      } catch (error) {
        console.error('\n❌ Authorization failed:', error.message);
        process.exit(1);
      }
    });

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`\n❌ Credentials file not found: ${CREDENTIALS_PATH}`);
      console.error('Please make sure calendar-credentials.json exists in the data/ folder');
    } else {
      console.error('\n❌ Error:', error.message);
    }
    process.exit(1);
  }
}

authorize();
