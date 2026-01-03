/**
 * Email Service for Driver App
 * Sends emails matching the exact templates used in the web app
 * Uses the same GoDaddy SMTP API endpoint
 */

const EMAIL_API_URL = process.env.EXPO_PUBLIC_EMAIL_API_URL || 'https://app.surecape.co.za/api/email/send';
const LOGO_URL = 'https://app.surecape.co.za/surecape-logo.png';

/**
 * Helper to create logo img tag for emails
 */
const createLogoImg = (style: string = 'max-width: 150px; height: auto; margin: 0 auto; display: block;') => {
  return `<img src="${LOGO_URL}" alt="SureCape Shuttle" width="150" height="auto" border="0" style="${style}" />`;
};

/**
 * Helper to extract location text from various field formats
 */
const getLocationString = (field: any): string => {
  if (!field) return 'Location not specified';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field.address || field.name || field.description || field.label || 'Location not specified';
  }
  return String(field);
};

/**
 * Send email via API endpoint
 */
async function sendEmail(emailData: {
  to_email: string;
  subject: string;
  html: string;
  from_email?: string;
  from_name?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📧 Sending email to:', emailData.to_email);
    console.log('📧 Subject:', emailData.subject);

    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: emailData.to_email,
        subject: emailData.subject,
        html: emailData.html,
        from: emailData.from_email || 'bookings@surecape.co.za',
        replyTo: 'support@surecape.co.za'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Email API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('✅ Email sent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send driver confirmation email when driver accepts a trip
 * This is the exact same email as sendDriverConfirmationEmail in the web app
 */
export async function sendDriverConfirmationEmail(
  customerEmail: string,
  customerName: string,
  bookingData: any,
  driverData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📧 Sending driver confirmation email to customer:', customerEmail);

    // Validate email
    if (!customerEmail || typeof customerEmail !== 'string') {
      throw new Error('Customer email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new Error(`Invalid customer email address: ${customerEmail}`);
    }

    const { bookingId, pickupDate, pickupTime, pickupLocation, dropoffLocation, trip_details } = bookingData;
    const driverName = driverData.full_name || driverData.name || 'Your driver';
    const driverPhone = driverData.phone || 'Not provided';
    
    // Get booked vehicle type from trip_details
    const bookedVehicleType = trip_details?.vehicle || bookingData.vehicle_type || '';
    
    // Extract vehicle info
    const vehicleInfo = driverData.vehicle || 
                       driverData.vehicle_info || 
                       driverData.selectedVehicle ||
                       {};

    // Format pickup date
    const formattedDate = pickupDate ? new Date(pickupDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    }) : 'Not specified';

    // Format vehicle information
    let vehicleDetails = bookedVehicleType || 'Vehicle details will be provided';
    let licensePlate = '';
    let vehicleColor = '';
    let hasVehicleInfo = false;
    
    if (vehicleInfo && typeof vehicleInfo === 'object' && Object.keys(vehicleInfo).length > 0) {
      const make = vehicleInfo.make || vehicleInfo.vehicle?.make || '';
      const model = vehicleInfo.model || vehicleInfo.vehicle?.model || '';
      const year = vehicleInfo.year || vehicleInfo.vehicle?.year || '';
      
      if (make || model) {
        const yearPart = year ? year + ' ' : '';
        const driverVehicle = (yearPart + make + ' ' + model).trim();
        // If we have both booked type and driver vehicle, show both
        if (bookedVehicleType && driverVehicle) {
          vehicleDetails = `${bookedVehicleType} (${driverVehicle})`;
        } else if (driverVehicle) {
          vehicleDetails = driverVehicle;
        }
        hasVehicleInfo = true;
      }
      
      const plate = vehicleInfo.licensePlate || 
                    vehicleInfo.license_plate ||
                    vehicleInfo.registrationNumber ||
                    vehicleInfo.registration ||
                    vehicleInfo.vehicle?.licensePlate ||
                    vehicleInfo.vehicle?.license_plate ||
                    vehicleInfo.vehicle?.registrationNumber ||
                    vehicleInfo.vehicle?.registration ||
                    '';
      
      if (plate) {
        licensePlate = plate;
        hasVehicleInfo = true;
      }
      
      vehicleColor = vehicleInfo.color || vehicleInfo.vehicle?.color || '';
    }
    
    // If no vehicle info available, use friendly message
    if (!licensePlate) {
      licensePlate = 'Your driver will contact you with vehicle details';
    }

    const subject = 'Driver Confirmed - Your Trip is Ready! Booking #' + bookingId;
    
    // Pre-format conditional values to avoid template issues
    const cleanPhoneStr = String(driverPhone || '');
    const cleanPhone = cleanPhoneStr.replace(/[^0-9]/g, '');
    const whatsappLink = cleanPhone ? 'https://wa.me/' + cleanPhone : '';
    const whatsappButton = whatsappLink ? `<a href="${whatsappLink}" style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">💬 WhatsApp</a>` : '';
    
    const vehicleColorLine = vehicleColor ? `<p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong style="color: #008080;">Color:</strong> ${vehicleColor}</p>` : '';
    
    const pickupTimeText = pickupTime || 'As scheduled';
    const pickupLocationText = pickupLocation || 'As confirmed';
    const dropoffLocationText = dropoffLocation || 'As confirmed';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Driver Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px; overflow: hidden;">
          <!-- Header with SureCape Branding -->
          <div style="background: white; text-align: center; padding: 30px 20px; border-bottom: 3px solid #008080;">
            ${createLogoImg('max-width: 180px; height: auto; margin: 0 auto 15px auto; display: block;')}
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px; color: #008080;">✅ Your Driver is Confirmed!</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">Your trip is ready to go</p>
          </div>

          <!-- Email Content -->
          <div style="padding: 30px 20px;">
            <h2 style="color: #008080; margin-top: 0; font-size: 28px; font-weight: 700;">Great News, ${customerName}!</h2>
            <p>Your driver has confirmed they will be handling your trip. Everything is set for your upcoming journey!</p>
            
            <!-- Confirmation Status -->
            <div style="background: linear-gradient(135deg, #008080 0%, #00aaaa 100%); border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center;">
              <div style="color: white; font-size: 48px; margin-bottom: 15px;">✔️</div>
              <h3 style="margin: 0 0 10px 0; color: white; font-size: 22px; font-weight: 700;">Driver Confirmed</h3>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your professional driver is ready and will arrive on time!</p>
            </div>

            <!-- Driver Information -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 25px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #008080; font-size: 20px; font-weight: 700; border-bottom: 2px solid #008080; padding-bottom: 12px;">👤 Your Driver</h3>
              <div style="margin-top: 20px;">
                <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong style="color: #008080;">Name:</strong> <span style="font-weight: 600;">${driverName}</span></p>
                <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong style="color: #008080;">Contact:</strong> <a href="tel:${driverPhone}" style="color: #059669; text-decoration: none; font-weight: 600;">${driverPhone}</a></p>
              </div>
            </div>

            <!-- Vehicle Information -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 25px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #008080; font-size: 20px; font-weight: 700; border-bottom: 2px solid #008080; padding-bottom: 12px;">🚗 Vehicle Details</h3>
              <div style="margin-top: 20px;">
                <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong style="color: #008080;">Vehicle:</strong> <span style="font-weight: 500;">${vehicleDetails}</span></p>
                ${vehicleColorLine}
                <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong style="color: #008080;">License Plate:</strong> <span style="font-weight: 600; background-color: #f0f9ff; padding: 6px 12px; border-radius: 4px; font-size: 18px;">${licensePlate}</span></p>
              </div>
            </div>

            <!-- Trip Details -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 25px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #008080; font-size: 20px; font-weight: 700; border-bottom: 2px solid #008080; padding-bottom: 12px;">📋 Trip Details</h3>
              <div style="margin-top: 20px;">
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Booking ID:</strong> <span style="font-weight: 600; background-color: #dbeafe; padding: 4px 8px; border-radius: 4px;">${bookingId}</span></p>
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Date:</strong> ${formattedDate}</p>
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Time:</strong> ${pickupTimeText}</p>
                
                <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #008080;">
                  <p style="margin: 0 0 10px 0; color: #008080; font-weight: 600;">📍 Pickup Location</p>
                  <p style="margin: 0; color: #1f2937;">${pickupLocationText}</p>
                </div>
                
                <div style="text-align: center; margin: 15px 0; color: #6b7280; font-size: 20px;">⬇️</div>
                
                <div style="padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #008080;">
                  <p style="margin: 0 0 10px 0; color: #008080; font-weight: 600;">🏁 Destination</p>
                  <p style="margin: 0; color: #1f2937;">${dropoffLocationText}</p>
                </div>
              </div>
            </div>

            <!-- Contact Driver -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 25px; margin-top: 25px; text-align: center;">
              <h4 style="margin: 0 0 20px 0; color: #008080; font-size: 18px; font-weight: 700;">📱 Contact Your Driver</h4>
              <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <a href="tel:${driverPhone}" style="display: inline-block; background: #008080; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">📞 Call Driver</a>
                ${whatsappButton}
              </div>
            </div>

            <!-- What to Expect -->
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-top: 25px;">
              <h4 style="margin: 0 0 15px 0; color: #008080; font-size: 16px; font-weight: 600;">📌 What to Expect</h4>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #333; font-size: 14px; line-height: 1.8;">
                <li>Your driver will arrive 10-15 minutes before the scheduled pickup time</li>
                <li>Look for the vehicle with license plate <strong>${licensePlate}</strong></li>
                <li>Your driver may call you upon arrival</li>
                <li>Have your booking reference ready: <strong>${bookingId}</strong></li>
              </ul>
            </div>

            <p style="margin-top: 25px;">If you have any questions or need to make changes, please contact your driver directly or reach out to our support team.</p>
            <p style="margin-top: 10px;">Have a safe and pleasant journey!</p>
            <p style="margin-top: 10px;">Warm regards,<br/>The SureCape Team</p>
          </div>
          
          <!-- Footer -->
          <div style="background: white; padding: 30px 20px; text-align: center; border-top: 3px solid #008080;">
            ${createLogoImg('width: 60px; height: 60px; margin: 0 auto 20px; display: block;')}
            <h3 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 700; color: #008080;">SureCape Shuttle Service</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">Premium Transportation • Professional Service • On Time</p>
            
            <div style="background-color: #f9f9f9; border: 1px solid #008080; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <div style="margin-bottom: 10px;">
                <a href="mailto:support@surecape.co.za" style="color: #008080; text-decoration: none; font-weight: 600;">📧 support@surecape.co.za</a>
              </div>
              <div>
                <a href="tel:+27640432833" style="color: #008080; text-decoration: none; font-weight: 600;">📱 +27 64 043 2833</a>
              </div>
              <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">Cape Town, South Africa</p>
            </div>
            
            <!-- Social Media Links -->
            <div style="margin-bottom: 20px;">
              <a href="https://www.facebook.com/share/1AdTmeBMfm/" target="_blank" style="display: inline-block; background-color: #1877f2; color: white; padding: 8px 16px; margin: 0 5px 5px 5px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">Facebook</a>
              <a href="https://www.instagram.com/surecape_za?igsh=emRuNzdmYWFxazQ=" target="_blank" style="display: inline-block; background-color: #e4405f; color: white; padding: 8px 16px; margin: 0 5px 5px 5px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">Instagram</a>
              <a href="https://wa.me/27640432833" target="_blank" style="display: inline-block; background-color: #25d366; color: white; padding: 8px 16px; margin: 0 5px 5px 5px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">WhatsApp</a>
              <a href="https://www.linkedin.com/company/surecape-shuttles/" target="_blank" style="display: inline-block; background-color: #0077b5; color: white; padding: 8px 16px; margin: 0 5px 5px 5px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">LinkedIn</a>
            </div>
            
            <div style="border-top: 1px solid #ddd; padding-top: 20px;">
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #999;">This is an automated notification message.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = {
      to_email: customerEmail,
      subject: subject,
      html: htmlContent,
      from_email: 'bookings@surecape.co.za',
      from_name: 'SureCape Bookings'
    };

    return await sendEmail(emailData);
  } catch (error: any) {
    console.error('❌ Error sending driver confirmation email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send trip completion email to customer
 * This is the exact same email as sendTripCompletionEmail in the web app
 */
export async function sendTripCompletionEmail(
  customerEmail: string,
  customerName: string,
  bookingData: any,
  driverData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📧 Sending trip completion email to customer:', customerEmail);
    
    // Validate email
    if (!customerEmail || typeof customerEmail !== 'string') {
      console.warn('⚠️ No customer email provided for completion notification');
      return { success: false, error: 'Customer email required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new Error(`Invalid customer email address: ${customerEmail}`);
    }

    const bookingId = bookingData.booking_reference || bookingData.booking_id || bookingData.id;
    
    const tripDetails = bookingData.trip_details || {};
    const pickupLocation = getLocationString(
      bookingData.pickup_location || 
      tripDetails.from || 
      bookingData.from ||
      tripDetails.pickupLocation
    );
    
    const dropoffLocation = getLocationString(
      bookingData.dropoff_location || 
      tripDetails.to || 
      bookingData.to ||
      tripDetails.dropoffLocation
    );
    
    const totalAmount = bookingData.total_amount || bookingData.amount || 0;
    const driverName = driverData.full_name || driverData.name || 'Your driver';
    
    const subject = `🎉 Trip Completed - Thank You! Booking #${bookingId}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trip Completed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px; overflow: hidden;">
          <!-- Header with SureCape Branding -->
          <div style="background: white; text-align: center; padding: 30px 20px; border-bottom: 3px solid #008080;">
            ${createLogoImg('max-width: 180px; height: auto; margin: 0 auto 15px auto; display: block;')}
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px; color: #008080;">🎉 Trip Completed!</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">We hope you had a pleasant journey</p>
          </div>

          <!-- Email Content -->
          <div style="padding: 30px 20px;">
            <h2 style="color: #008080; margin-top: 0; font-size: 28px; font-weight: 700;">Thank You, ${customerName}!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #1f2937;">We appreciate you choosing SureCape for your transportation needs. Your trip has been successfully completed.</p>
            
            <!-- Feedback Request -->
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; border: 2px solid #0284c7;">
              <h3 style="margin: 0 0 10px 0; color: #0284c7; font-size: 20px;">⭐ How Was Your Experience?</h3>
              <p style="margin: 0 0 15px 0; color: #1f2937;">We'd love to hear your feedback! Please share your experience on Google Reviews to help us improve our service.</p>
              <a href="https://g.page/r/CXT2tWC9Na4AEBM/review" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; margin-top: 10px;">⭐ Leave a Google Review</a>
            </div>
            
            <!-- Trip Summary -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 25px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #008080; font-size: 20px; font-weight: 700; border-bottom: 2px solid #008080; padding-bottom: 12px;">📋 Trip Summary</h3>
              <div style="margin-top: 20px;">
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Booking ID:</strong> <span style="font-weight: 600; background-color: #dbeafe; padding: 4px 8px; border-radius: 4px;">${bookingId}</span></p>
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Driver:</strong> ${driverName}</p>
                <p style="margin: 12px 0; color: #1f2937;"><strong style="color: #008080;">Completed:</strong> ${new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                
                <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #008080;">
                  <p style="margin: 0 0 10px 0; color: #008080; font-weight: 600;">📍 From</p>
                  <p style="margin: 0; color: #1f2937;">${pickupLocation}</p>
                </div>
                
                <div style="text-align: center; margin: 15px 0; color: #6b7280; font-size: 20px;">⬇️</div>
                
                <div style="padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #008080;">
                  <p style="margin: 0 0 10px 0; color: #008080; font-weight: 600;">🏁 To</p>
                  <p style="margin: 0; color: #1f2937;">${dropoffLocation}</p>
                </div>

                ${totalAmount > 0 ? `
                <div style="margin-top: 20px; padding: 15px; background-color: #ecfdf5; border-radius: 8px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #059669; font-size: 14px; font-weight: 600;">Total Amount</p>
                  <p style="margin: 0; color: #047857; font-size: 28px; font-weight: 700;">R${parseFloat(totalAmount).toFixed(2)}</p>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Thank You Message -->
            <div style="text-align: center; margin: 30px 0; padding: 25px; background-color: #f9fafb; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #008080; font-size: 22px; font-weight: 700;">Thank You for Traveling with SureCape!</h3>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.6;">We appreciate your business and look forward to serving you again soon. Safe travels!</p>
            </div>

            <!-- Contact Information -->
            <div style="background: white; border: 2px solid #008080; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <h3 style="margin: 0 0 15px 0; color: #008080; font-size: 18px; font-weight: 700;">Need Help?</h3>
              <p style="margin: 5px 0; color: #1f2937;">📧 <a href="mailto:support@surecape.co.za" style="color: #059669; text-decoration: none; font-weight: 600;">support@surecape.co.za</a></p>
              <p style="margin: 5px 0; color: #1f2937;">🌐 <a href="https://surecape.co.za" style="color: #059669; text-decoration: none; font-weight: 600;">www.surecape.co.za</a></p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 25px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
              Professional transportation services you can trust.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = {
      to_email: customerEmail,
      subject: subject,
      html: htmlContent,
      from_email: 'bookings@surecape.co.za',
      from_name: 'SureCape Shuttle Service'
    };

    const result = await sendEmail(emailData);
    console.log('✅ Trip completion email sent successfully');
    return result;

  } catch (error: any) {
    console.error('❌ Error sending trip completion email:', error);
    return { success: false, error: error.message };
  }
}

export const emailService = {
  sendDriverConfirmationEmail,
  sendTripCompletionEmail,
};
