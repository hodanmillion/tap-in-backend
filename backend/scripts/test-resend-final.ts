
import { Resend } from 'resend';

const resend = new Resend('re_6wtqBC7i_4xKWwyKxTswXUCvuUncJXwGe');

async function test() {
  console.log('Testing Resend with key: re_6wtqBC7i...wGe');
  try {
    const { data, error } = await resend.emails.send({
      from: 'TapIn <noreply@securim.ca>',
      to: ['welon53412@gxuzi.com'],
      subject: 'Test Email',
      html: '<p>Test</p>',
    });

    if (error) {
      console.error('Resend Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Resend Success:', data);
    }
  } catch (err) {
    console.error('Unexpected Error:', err);
  }
}

test();
