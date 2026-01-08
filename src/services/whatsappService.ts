/**
 * WhatsApp Notification Service using Infobip
 * Sends WhatsApp messages using Infobip templates for trip updates
 */

const INFOBIP_BASE_URL = process.env.EXPO_PUBLIC_INFOBIP_BASE_URL || 'https://api.infobip.com';
const INFOBIP_API_KEY = process.env.EXPO_PUBLIC_INFOBIP_API_KEY || '';
const INFOBIP_SENDER = process.env.EXPO_PUBLIC_INFOBIP_SENDER || '';

interface WhatsAppMessage {
  to: string;
  templateName: string;
  templateData?: Record<string, any>;
  language?: string;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format phone number for WhatsApp (remove spaces, ensure international format)
 */
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with 0, replace with +27 (South African country code)
  if (cleaned.startsWith('0')) {
    cleaned = '+27' + cleaned.substring(1);
  }
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};

/**
 * Send WhatsApp message via Infobip API
 */
async function sendWhatsAppMessage({
  to,
  templateName,
  templateData = {},
  language = 'en'
}: WhatsAppMessage): Promise<WhatsAppResponse> {
  try {
    if (!INFOBIP_API_KEY || !INFOBIP_SENDER) {
      console.warn('⚠️ Infobip not configured - WhatsApp message not sent');
      return { success: false, error: 'Infobip not configured' };
    }

    const formattedPhone = formatPhoneNumber(to);
    
    if (!formattedPhone) {
      console.error('❌ Invalid phone number:', to);
      return { success: false, error: 'Invalid phone number' };
    }

    console.log('📱 Sending WhatsApp message to:', formattedPhone);
    console.log('📝 Template:', templateName);
    console.log('📊 Template data:', templateData);

    // Build template parameters array from templateData
    // Infobip expects simple string array, not objects
    const templateParams = Object.values(templateData).map(value => String(value));

    const payload = {
      messages: [
        {
          from: INFOBIP_SENDER,
          to: formattedPhone,
          messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          content: {
            templateName: templateName,
            templateData: {
              body: {
                placeholders: templateParams
              }
            },
            language: language
          }
        }
      ]
    };

    console.log('🚀 Sending to Infobip:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/message/template`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('📥 Infobip response:', result);
    
    // Log detailed status information
    if (result.messages?.[0]?.status) {
      const status = result.messages[0].status;
      console.log('📊 Message Status:', {
        groupId: status.groupId,
        groupName: status.groupName,
        id: status.id,
        name: status.name,
        description: status.description
      });
    }

    if (!response.ok) {
      console.error('❌ Infobip API error:', result);
      return {
        success: false,
        error: result.requestError?.serviceException?.text || 'Failed to send WhatsApp message'
      };
    }

    const messageId = result.messages?.[0]?.messageId;
    const statusName = result.messages?.[0]?.status?.name;
    console.log('✅ WhatsApp message sent to Infobip:', messageId, 'Status:', statusName);

    return {
      success: true,
      messageId: messageId
    };

  } catch (error: any) {
    console.error('❌ WhatsApp service error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error sending WhatsApp message'
    };
  }
}

/**
 * Send driver assignment notification to driver
 * Template: driver_assignment
 */
export async function sendDriverAssignmentNotification(
  driverPhone: string,
  driverName: string,
  bookingId: string,
  pickupLocation: string,
  pickupDateTime: string,
  customerName: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppMessage({
    to: driverPhone,
    templateName: 'driver_assignment',
    templateData: {
      driver_name: driverName,
      booking_id: bookingId,
      pickup_location: pickupLocation,
      pickup_time: pickupDateTime,
      customer_name: customerName
    }
  });
}

/**
 * Send trip confirmation notification to customer
 * Template: trip_confirmed
 */
export async function sendTripConfirmationNotification(
  customerPhone: string,
  customerName: string,
  driverName: string,
  vehicleInfo: string,
  licensePlate: string,
  pickupDateTime: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppMessage({
    to: customerPhone,
    templateName: 'trip_confirmed',
    templateData: {
      customer_name: customerName,
      driver_name: driverName,
      vehicle_info: vehicleInfo,
      license_plate: licensePlate,
      pickup_time: pickupDateTime
    }
  });
}

/**
 * Send trip started notification to customer
 * Template: trip_started
 */
export async function sendTripStartedNotification(
  customerPhone: string,
  customerName: string,
  driverName: string,
  driverPhone: string,
  trackingUrl?: string
): Promise<WhatsAppResponse> {
  const templateData: Record<string, any> = {
    customer_name: customerName,
    driver_name: driverName,
    driver_phone: driverPhone
  };

  if (trackingUrl) {
    templateData.tracking_url = trackingUrl;
  }

  return sendWhatsAppMessage({
    to: customerPhone,
    templateName: 'trip_started',
    templateData
  });
}

/**
 * Send trip completed notification to customer
 * Template: trip_completed
 */
export async function sendTripCompletedNotification(
  customerPhone: string,
  customerName: string,
  dropoffLocation: string,
  totalAmount?: string
): Promise<WhatsAppResponse> {
  const templateData: Record<string, any> = {
    customer_name: customerName,
    dropoff_location: dropoffLocation
  };

  if (totalAmount) {
    templateData.total_amount = totalAmount;
  }

  return sendWhatsAppMessage({
    to: customerPhone,
    templateName: 'trip_completed',
    templateData
  });
}

/**
 * Send trip cancelled notification
 * Template: trip_cancelled
 */
export async function sendTripCancelledNotification(
  recipientPhone: string,
  recipientName: string,
  bookingId: string,
  reason?: string
): Promise<WhatsAppResponse> {
  const templateData: Record<string, any> = {
    recipient_name: recipientName,
    booking_id: bookingId
  };

  if (reason) {
    templateData.reason = reason;
  }

  return sendWhatsAppMessage({
    to: recipientPhone,
    templateName: 'trip_cancelled',
    templateData
  });
}

/**
 * Send generic notification message
 * For custom messages not using templates
 */
export async function sendCustomWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppResponse> {
  try {
    if (!INFOBIP_API_KEY || !INFOBIP_SENDER) {
      console.warn('⚠️ Infobip not configured - WhatsApp message not sent');
      return { success: false, error: 'Infobip not configured' };
    }

    const formattedPhone = formatPhoneNumber(phone);
    
    if (!formattedPhone) {
      console.error('❌ Invalid phone number:', phone);
      return { success: false, error: 'Invalid phone number' };
    }

    const payload = {
      messages: [
        {
          from: INFOBIP_SENDER,
          to: formattedPhone,
          messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          content: {
            text: message
          }
        }
      ]
    };

    const response = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/message/text`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Infobip API error:', result);
      return {
        success: false,
        error: result.requestError?.serviceException?.text || 'Failed to send WhatsApp message'
      };
    }

    return {
      success: true,
      messageId: result.messages?.[0]?.messageId
    };

  } catch (error: any) {
    console.error('❌ WhatsApp service error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export default {
  sendDriverAssignmentNotification,
  sendTripConfirmationNotification,
  sendTripStartedNotification,
  sendTripCompletedNotification,
  sendTripCancelledNotification,
  sendCustomWhatsAppMessage
};
