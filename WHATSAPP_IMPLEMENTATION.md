# WhatsApp Notifications via Infobip - Implementation Guide

## Overview

The SureCape Driver App now sends WhatsApp notifications to customers using Infobip's WhatsApp Business API. This provides instant, reliable notifications for trip updates directly on WhatsApp.

## Features Implemented

✅ **Trip Confirmation** - When driver accepts a trip, customer receives WhatsApp with driver & vehicle details  
✅ **Trip Started** - When driver starts the trip, customer receives notification with tracking link  
✅ **Trip Completed** - When trip is complete, customer receives thank you message with total amount  
✅ **Professional Templates** - Uses Infobip approved WhatsApp templates  
✅ **Phone Number Formatting** - Automatically formats South African numbers (+27)  
✅ **Non-blocking** - WhatsApp failures don't block trip status updates  
✅ **Dual Notifications** - Sends both Email AND WhatsApp for maximum reach  

## Architecture

```
Driver App (React Native)
    ↓ (Driver accepts/starts/completes trip)
src/services/supabase.ts (updateTripStatus)
    ↓ (Sends notifications)
src/services/whatsappService.ts
    ↓ (HTTP POST)
Infobip WhatsApp Business API
    ↓
Customer's WhatsApp
```

## Configuration

### 1. Infobip Account Setup

1. **Sign up for Infobip**: https://www.infobip.com/signup
2. **Get your API Key**:
   - Log in to Infobip Portal
   - Navigate to "Developers" → "API Keys"
   - Create a new API key or copy existing one
3. **Get WhatsApp Sender Number**:
   - Navigate to "Channels" → "WhatsApp"
   - Set up WhatsApp Business sender number
   - Get approval from WhatsApp (usually takes 1-2 business days)
   - Copy the sender number (format: 27XXXXXXXXX)

### 2. Create WhatsApp Message Templates

In the Infobip portal, create the following approved templates:

#### Template 1: `trip_confirmed`
**Category**: Transactional  
**Language**: English  
**Content**:
```
Hello {{1}}, your trip with SureCape has been confirmed! 🚗

Driver: {{2}}
Vehicle: {{3}} ({{4}})
Pickup Time: {{5}}

Your driver will contact you shortly. Have a great trip!
```

**Variables**:
1. Customer Name
2. Driver Name
3. Vehicle Info (Make/Model)
4. License Plate
5. Pickup DateTime

#### Template 2: `trip_started`
**Category**: Transactional  
**Language**: English  
**Content**:
```
Hi {{1}}, your trip has started! 🚗✨

Driver: {{2}}
Contact: {{3}}

Track your ride in real-time: {{4}}

Safe travels!
```

**Variables**:
1. Customer Name
2. Driver Name
3. Driver Phone
4. Tracking URL (optional)

#### Template 3: `trip_completed`
**Category**: Transactional  
**Language**: English  
**Content**:
```
Thank you {{1}} for traveling with SureCape! 🎉

Trip completed to: {{2}}
Total Amount: {{3}}

We'd love your feedback! Please leave us a Google review: https://g.page/r/CXT2tWC9Na4AEBM/review

SureCape Transport - Your trusted partner
```

**Variables**:
1. Customer Name
2. Drop-off Location
3. Total Amount (optional)

#### Template 4: `trip_cancelled`
**Category**: Transactional  
**Language**: English  
**Content**:
```
Hello {{1}}, your booking #{{2}} has been cancelled.

Reason: {{3}}

Need help? Contact us at +27 64 043 2833 or bookings@surecape.co.za

SureCape Transport
```

**Variables**:
1. Recipient Name
2. Booking ID
3. Reason (optional)

### 3. Environment Variables

Add these to your `.env` file:

```bash
# Infobip WhatsApp Configuration
EXPO_PUBLIC_INFOBIP_BASE_URL=https://api.infobip.com
EXPO_PUBLIC_INFOBIP_API_KEY=your-infobip-api-key-here
EXPO_PUBLIC_INFOBIP_SENDER=27640432833
```

**Where to find these values:**
- `EXPO_PUBLIC_INFOBIP_BASE_URL`: Always `https://api.infobip.com` (or your region-specific URL)
- `EXPO_PUBLIC_INFOBIP_API_KEY`: Found in Infobip Portal → Developers → API Keys
- `EXPO_PUBLIC_INFOBIP_SENDER`: Your WhatsApp Business sender number (without + sign)

### 4. Template Name Configuration

If your template names in Infobip differ from the defaults, update them in `src/services/whatsappService.ts`:

```typescript
// Change template names to match your Infobip templates
templateName: 'trip_confirmed'  // Change to your template name
templateName: 'trip_started'    // Change to your template name
templateName: 'trip_completed'  // Change to your template name
templateName: 'trip_cancelled'  // Change to your template name
```

## Files Created/Modified

### New Files

**`src/services/whatsappService.ts`** (362 lines)
- Complete WhatsApp notification service
- Infobip API integration
- Phone number formatting for South African numbers
- Template-based messaging
- Functions for all trip status notifications:
  * `sendDriverAssignmentNotification()` - When admin assigns driver (web app)
  * `sendTripConfirmationNotification()` - When driver accepts trip
  * `sendTripStartedNotification()` - When driver starts trip
  * `sendTripCompletedNotification()` - When driver completes trip
  * `sendTripCancelledNotification()` - When trip is cancelled
  * `sendCustomWhatsAppMessage()` - For custom messages

### Modified Files

**`src/services/supabase.ts`**
- Updated `updateTripStatus()` function
- Now imports and calls WhatsApp service alongside email service
- Sends WhatsApp notifications for:
  * **accepted** status → `sendTripConfirmationNotification()`
  * **in_progress/started** status → `sendTripStartedNotification()`
  * **completed** status → `sendTripCompletedNotification()`
- Extracts customer phone from trip details
- Logs all WhatsApp attempts and results

**`.env` and `.env.example`**
- Added Infobip configuration variables

## How It Works

### When Driver Accepts Trip

1. Driver taps "Accept Trip" in mobile app
2. App calls `driverService.acceptAssignment(tripId)`
3. `updateTripStatus()` updates database to 'confirmed'
4. Fetches customer phone from `booking.trip_details.customerInfo.phone`
5. Calls `sendTripConfirmationNotification()` with:
   - Customer phone & name
   - Driver name
   - Vehicle info & license plate
   - Pickup date/time
6. `whatsappService` formats phone number (+27)
7. Sends POST request to Infobip API with template & data
8. Customer receives WhatsApp notification instantly

### When Driver Starts Trip

1. Driver taps "Start Trip" button
2. App calls `startTrip()` which updates status to 'in_progress'
3. System sends WhatsApp with:
   - Driver contact info
   - Real-time tracking URL (if available)
4. Customer can track driver's location

### When Driver Completes Trip

1. Driver taps "Complete Trip" button
2. App updates status to 'completed'
3. System sends:
   - Email with full trip details & Google review link
   - WhatsApp with thank you message & total amount
4. Customer receives both notifications

## Phone Number Formatting

The service automatically formats phone numbers:

```typescript
// Inputs               → Output
'0695268777'          → '+27695268777'
'27695268777'         → '+27695268777'
'+27695268777'        → '+27695268777'
'064 043 2833'        → '+27640432833'
'(064) 043-2833'      → '+27640432833'
```

**Supported countries**: Currently optimized for South African numbers (+27). For other countries, update the `formatPhoneNumber()` function in `whatsappService.ts`.

## Error Handling

WhatsApp notifications are **non-blocking**:
- If WhatsApp fails, trip status update still succeeds
- Errors are logged but don't throw exceptions
- Email notifications continue to work as fallback

**Common errors:**
- `Infobip not configured` - Missing API key or sender number
- `Invalid phone number` - Empty or malformed phone number
- `Template not found` - Template name doesn't match Infobip
- `Unauthorized` - Invalid API key

## Testing

### 1. Test with Infobip Portal

Before using in the app, test templates in Infobip:
1. Go to "Channels" → "WhatsApp" → "Send Message"
2. Select your approved template
3. Fill in test data
4. Send to your own WhatsApp number
5. Verify formatting and content

### 2. Test in App

1. Start Expo server: `npm start`
2. Open app in Expo Go
3. Accept a trip
4. Check console logs for:
   ```
   📱 Sending WhatsApp message to: +27XXXXXXXXX
   📝 Template: trip_confirmed
   📊 Template data: {...}
   ✅ WhatsApp message sent successfully: msg-123456789
   ```
5. Check customer's WhatsApp for message
6. Test trip start and completion as well

### 3. Debugging

Enable detailed logging:
```typescript
// In src/services/whatsappService.ts
console.log('🚀 Sending to Infobip:', JSON.stringify(payload, null, 2));
console.log('📥 Infobip response:', result);
```

Check Infobip logs:
1. Log in to Infobip Portal
2. Go to "Analytics" → "Logs"
3. View message delivery status
4. Check for failed messages

## Template Customization

To customize templates:

1. **Update in Infobip Portal**:
   - Navigate to "Channels" → "WhatsApp" → "Templates"
   - Edit existing template
   - Submit for WhatsApp approval (24-48 hours)

2. **Update in App**:
   - Modify `src/services/whatsappService.ts`
   - Update the `templateData` object with new placeholders
   - Match variable order with Infobip template

Example:
```typescript
// If your template has different placeholders:
return sendWhatsAppMessage({
  to: customerPhone,
  templateName: 'trip_confirmed',
  templateData: {
    customer_name: customerName,      // {{1}}
    driver_name: driverName,          // {{2}}
    vehicle_info: vehicleInfo,        // {{3}}
    license_plate: licensePlate,      // {{4}}
    pickup_time: pickupDateTime,      // {{5}}
    booking_id: bookingId             // {{6}} - NEW
  }
});
```

## Cost Considerations

**Infobip Pricing** (approximate, check current rates):
- WhatsApp Business API: ~$0.005 - $0.02 per message (varies by country)
- Template messages are generally cheaper than session messages
- Inbound messages from customers may have different rates

**Tips to optimize costs:**
- Use templates (cheaper than custom messages)
- Combine multiple updates when possible
- Only send critical notifications
- Consider daily message limits

## Compliance & Best Practices

### WhatsApp Business Policy

✅ **Do:**
- Only send transactional messages related to trip bookings
- Use approved templates for all messages
- Provide opt-out mechanism
- Respect customer preferences

❌ **Don't:**
- Send marketing messages without consent
- Send unsolicited messages
- Use session messages for transactional updates
- Exceed rate limits

### Data Privacy

- Customer phone numbers stored in `booking.trip_details.customerInfo.phone`
- Never log or store full phone numbers in plain text logs
- Comply with POPIA (South African data protection law)
- Provide customers way to opt out of WhatsApp notifications

### Rate Limits

Infobip rate limits vary by account:
- Check your account limits in Infobip Portal
- Implement retry logic for failed messages
- Consider queuing for high-volume scenarios

## Advanced Features

### Custom Messages

For one-off custom messages (not using templates):

```typescript
import { sendCustomWhatsAppMessage } from './services/whatsappService';

await sendCustomWhatsAppMessage(
  '+27695268777',
  'Hello! This is a custom message from SureCape.'
);
```

**Note**: Custom messages may have higher costs and stricter limits.

### Message Status Tracking

To track delivery status, implement webhooks:

1. Configure webhook URL in Infobip Portal
2. Create endpoint to receive delivery reports
3. Update database with message status

Example webhook payload:
```json
{
  "results": [{
    "messageId": "msg-123456789",
    "to": "27695268777",
    "status": {
      "groupId": 3,
      "groupName": "DELIVERED",
      "id": 5,
      "name": "DELIVERED_TO_HANDSET"
    }
  }]
}
```

## Troubleshooting

### WhatsApp messages not sending

1. **Check configuration**:
   ```bash
   # Verify .env file has correct values
   cat .env | grep INFOBIP
   ```

2. **Check Infobip API key**:
   - Log in to Infobip Portal
   - Verify API key is active
   - Check permissions include WhatsApp

3. **Check template approval**:
   - Templates must be approved by WhatsApp
   - Check status in Infobip Portal

4. **Check phone number**:
   - Must include country code
   - WhatsApp account must exist for recipient
   - Number format: +27XXXXXXXXX

5. **Check logs**:
   - In app: Look for WhatsApp service logs
   - In Infobip: Check message logs in Analytics

### Template errors

**Error**: "Template not found"
- **Fix**: Update template name in `whatsappService.ts` to match Infobip

**Error**: "Invalid template data"
- **Fix**: Ensure placeholder count matches template variables

**Error**: "Template not approved"
- **Fix**: Wait for WhatsApp approval (24-48 hours)

### Phone number errors

**Error**: "Invalid phone number"
- **Fix**: Ensure customer phone is stored in database
- **Fix**: Check `booking.trip_details.customerInfo.phone` field

**Error**: "Phone number not on WhatsApp"
- **Fix**: Customer must have WhatsApp account
- **Fix**: Fall back to SMS or email

## Next Steps

### Recommended Enhancements

1. **Delivery Tracking**:
   - Implement webhooks for delivery reports
   - Show message status in admin dashboard
   - Retry failed messages

2. **Template Management**:
   - Create admin UI to manage templates
   - Test templates before deployment
   - Version control for templates

3. **Multi-language Support**:
   - Detect customer language preference
   - Create templates in multiple languages
   - Auto-select based on customer profile

4. **Rich Media**:
   - Add images to WhatsApp messages
   - Include PDF invoices
   - Send location coordinates

5. **Two-way Communication**:
   - Allow customers to reply to WhatsApp messages
   - Handle incoming messages
   - Create chatbot for common questions

## Support

- **Infobip Documentation**: https://www.infobip.com/docs/api
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **SureCape Support**: bookings@surecape.co.za

## Summary

✅ Complete WhatsApp integration with Infobip  
✅ Sends notifications for trip acceptance, start, and completion  
✅ Professional templates with customer & trip details  
✅ Automatic phone number formatting  
✅ Non-blocking error handling  
✅ Works alongside email notifications  
✅ Ready for production use  

**Next**: Configure your Infobip account, create templates, and test with real trips!
