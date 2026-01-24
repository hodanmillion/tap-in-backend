
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  const email = 'hodanmo15@gmail.com'; // Sending to account holder should work if domain is verified or even if not (if using onboarding)
  console.log(`Testing domain verification for securim.ca...`);
  try {
    const { data, error } = await resend.emails.send({
      from: 'TapIn <noreply@securim.ca>',
      to: [email],
      subject: 'Domain Test',
      html: '<p>Testing if securim.ca is verified.</p>'
    });
    
    if (error) {
      console.error('Resend Error:', error);
    } else {
      console.log('Resend Success:', data);
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

testEmail();
