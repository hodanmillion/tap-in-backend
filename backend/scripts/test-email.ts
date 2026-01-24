
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  const email = 'welon53412@gxuzi.com';
  console.log(`Sending test email to ${email} using ${process.env.RESEND_API_KEY ? 'provided key' : 'no key'}`);
  try {
    const { data, error } = await resend.emails.send({
      from: 'TapIn <onboarding@resend.dev>',
      to: [email],
      subject: 'Test Email from Orchids',
      html: '<p>If you see this, Resend is working with the default domain.</p>'
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
