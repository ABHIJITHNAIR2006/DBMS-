/**
 * QR Code Generator Service (Loaded lazily)
 * Creates data URLs and 3x8 label sheets for physical inventory tracking
 */

export interface QrItemPayload {
  itemId: string;
  name: string;
  category: string;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 128,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });
}
