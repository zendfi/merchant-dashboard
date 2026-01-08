// WebAuthn utility functions

/**
 * Passkey signature type for authenticated operations
 */
export interface PasskeySignature {
  credential_id: string;
  authenticator_data: number[];
  signature: number[];
  client_data_json: number[];
}

/**
 * Base64url encode a buffer
 */
export function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode to Uint8Array
 */
export function base64urlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaryString = atob(base64 + padding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * Check if WebAuthn is supported
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.PublicKeyCredential && navigator.credentials);
}

/**
 * Get passkey credential for authentication
 */
export async function getPasskeyCredential(options: {
  challenge: string;
  allowCredentials: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  timeout?: number;
  rpId?: string;
  userVerification?: string;
}): Promise<{
  id: string;
  rawId: string;
  type: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle: string | null;
  };
} | null> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // Remove transports from allowCredentials (can cause issues)
  const cleanedCredentials = options.allowCredentials.map((cred) => {
    const { transports, ...rest } = cred;
    void transports; // Suppress unused variable warning
    return rest;
  });

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToUint8Array(options.challenge),
      allowCredentials: cleanedCredentials.map((cred) => ({
        id: base64urlToUint8Array(cred.id),
        type: cred.type as PublicKeyCredentialType,
      })),
      timeout: options.timeout || 60000,
      rpId: options.rpId,
      userVerification: (options.userVerification as UserVerificationRequirement) || 'preferred',
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    return null;
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: base64urlEncode(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: base64urlEncode(response.authenticatorData),
      clientDataJSON: base64urlEncode(response.clientDataJSON),
      signature: base64urlEncode(response.signature),
      userHandle: response.userHandle ? base64urlEncode(response.userHandle) : null,
    },
  };
}

/**
 * Get passkey signature for sensitive operations (withdrawal, export)
 */
export async function getPasskeySignature(data: {
  to_address?: string;
  amount?: number;
  token?: string;
}): Promise<{
  credential_id: string;
  authenticator_data: number[];
  signature: number[];
  client_data_json: number[];
} | null> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challengeData = JSON.stringify(data);
  const challenge = new TextEncoder().encode(challengeData);

  try {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId:
          window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return null;
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      credential_id: base64urlEncode(credential.rawId),
      authenticator_data: Array.from(
        new Uint8Array(response.authenticatorData || new ArrayBuffer(0))
      ),
      signature: Array.from(new Uint8Array(response.signature || new ArrayBuffer(0))),
      client_data_json: Array.from(
        new Uint8Array(response.clientDataJSON || new ArrayBuffer(0))
      ),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Passkey authentication was cancelled');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Passkeys are not supported on this device');
      }
    }
    throw error;
  }
}

/**
 * Create a new passkey credential
 */
export async function createPasskeyCredential(options: {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: {
    residentKey?: string;
    userVerification?: string;
    authenticatorAttachment?: string;
  };
}): Promise<{
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
} | null> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const authenticatorSelection: AuthenticatorSelectionCriteria = {
    residentKey: (options.authenticatorSelection?.residentKey as ResidentKeyRequirement) || 'preferred',
    userVerification:
      (options.authenticatorSelection?.userVerification as UserVerificationRequirement) || 'required',
    ...(options.authenticatorSelection?.authenticatorAttachment && {
      authenticatorAttachment: options.authenticatorSelection
        .authenticatorAttachment as AuthenticatorAttachment,
    }),
  };

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToUint8Array(options.challenge),
      rp: options.rp,
      user: {
        id: base64urlToUint8Array(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams as PublicKeyCredentialParameters[],
      timeout: options.timeout || 120000,
      attestation: (options.attestation as AttestationConveyancePreference) || 'none',
      authenticatorSelection,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    return null;
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: base64urlEncode(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: base64urlEncode(response.clientDataJSON),
      attestationObject: base64urlEncode(response.attestationObject),
    },
  };
}
