// Queen Mama LITE - Auth API Service
// Handles authentication endpoints

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    subscriptionPlan: string;
    createdAt: string;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

// Start device code flow
export async function initiateDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'queen-mama-lite' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Failed to initiate device code flow');
  }

  return response.json();
}

// Poll for device authorization
export async function pollDeviceAuthorization(
  deviceCode: string
): Promise<AuthTokenResponse | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  });

  if (response.status === 202) {
    // Authorization pending
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Authorization failed');
  }

  return response.json();
}

// Refresh access token
export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/macos/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Token refresh failed');
  }

  return response.json();
}

// Validate license
export async function validateLicense(accessToken: string): Promise<{
  valid: boolean;
  plan: string;
  features: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/license/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('License validation failed');
  }

  return response.json();
}

export default {
  initiateDeviceCode,
  pollDeviceAuthorization,
  refreshAccessToken,
  validateLicense,
};
