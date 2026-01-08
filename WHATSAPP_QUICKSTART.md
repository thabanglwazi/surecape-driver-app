# WhatsApp Integration - Quick Reference

## Setup Checklist

- [ ] Sign up for Infobip account: https://www.infobip.com/signup
- [ ] Get API key from Infobip Portal → Developers → API Keys
- [ ] Set up WhatsApp Business sender number
- [ ] Create 4 message templates (see WHATSAPP_IMPLEMENTATION.md)
- [ ] Wait for WhatsApp template approval (24-48 hours)
- [ ] Update `.env` file with Infobip credentials
- [ ] Test templates in Infobip Portal
- [ ] Test in app with real trip

## Required Templates

| Template Name | Purpose | Variables |
|--------------|---------|-----------|
| `trip_confirmed` | Driver accepts trip | Customer name, Driver name, Vehicle, License, Pickup time |
| `trip_started` | Driver starts trip | Customer name, Driver name, Driver phone, Tracking URL |
| `trip_completed` | Driver completes trip | Customer name, Dropoff location, Total amount |
| `trip_cancelled` | Trip cancelled | Recipient name, Booking ID, Reason |

## Environment Variables

```bash
EXPO_PUBLIC_INFOBIP_BASE_URL=https://api.infobip.com
EXPO_PUBLIC_INFOBIP_API_KEY=your-api-key-here
EXPO_PUBLIC_INFOBIP_SENDER=27640432833
```

## When WhatsApp Messages Are Sent

| Driver Action | Status in DB | Email | WhatsApp |
|--------------|--------------|-------|----------|
| Accept Trip | `confirmed` | ✅ Driver confirmation | ✅ trip_confirmed |
| Start Trip | `in_progress` | ❌ | ✅ trip_started |
| Complete Trip | `completed` | ✅ Trip completion | ✅ trip_completed |

## Testing

```bash
# 1. Start the app
npm start

# 2. In the app:
#    - Accept a trip
#    - Check console for: "📱 Sending WhatsApp message to: +27XXXXXXXXX"
#    - Check console for: "✅ WhatsApp message sent successfully"

# 3. Verify:
#    - Customer receives WhatsApp message
#    - Message contains correct trip details
#    - Links work correctly
```

## Troubleshooting

**No messages sending?**
1. Check `.env` has correct INFOBIP credentials
2. Verify templates are approved in Infobip Portal
3. Check customer phone number exists in database
4. Check console logs for errors

**Template errors?**
1. Template names must match exactly (case-sensitive)
2. Number of variables must match template placeholders
3. Templates must be approved by WhatsApp

**Phone number errors?**
1. Customer phone stored in `booking.trip_details.customerInfo.phone`
2. Format: Any of these work: `0695268777`, `27695268777`, `+27695268777`
3. Customer must have WhatsApp installed

## Files Changed

- ✅ `src/services/whatsappService.ts` (NEW) - WhatsApp service
- ✅ `src/services/supabase.ts` - Added WhatsApp integration
- ✅ `.env` - Added Infobip config
- ✅ `.env.example` - Added Infobip config
- ✅ `WHATSAPP_IMPLEMENTATION.md` (NEW) - Full documentation

## Next Steps

1. **Get Infobip credentials** → Update `.env`
2. **Create templates** → Wait for approval
3. **Test in Expo Go** → Accept/start/complete trip
4. **Monitor delivery** → Check Infobip Portal logs
5. **Go live** → Enable for all trips

## Support

- Infobip Docs: https://www.infobip.com/docs/api
- Infobip Support: support@infobip.com
- SureCape Support: bookings@surecape.co.za
