import type { Prisma } from "@prisma/client";

export const publicTrustRecordSelect = {
  id: true,
  type: true,
  status: true,
  version: true,
  issuerId: true,
  holderId: true,
  templateId: true,
  publicSummaryJson: true,
  evidenceHash: true,
  signature: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  disputeState: true,
  createdAt: true,
  updatedAt: true,
  issuer: {
    select: {
      id: true,
      name: true,
      verified: true,
      status: true
    }
  },
  holder: {
    select: {
      id: true,
      displayName: true,
      email: true
    }
  },
  consentGrants: {
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      mode: true,
      purpose: true,
      audience: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
      accessCount: true,
      createdAt: true
    }
  },
  verificationEvents: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      verifierReference: true,
      purpose: true,
      status: true,
      reasonCodes: true,
      cached: true,
      createdAt: true
    }
  },
  revocation: {
    select: {
      id: true,
      reason: true,
      reasonCode: true,
      createdAt: true
    }
  },
  disputes: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      holderId: true,
      issuerId: true,
      openedByEmail: true,
      reason: true,
      status: true,
      outcome: true,
      createdAt: true,
      updatedAt: true
    }
  }
} satisfies Prisma.TrustRecordSelect;

export const publicAuditAnchorSelect = {
  id: true,
  sequence: true,
  issuerId: true,
  recordId: true,
  action: true,
  status: true,
  version: true,
  payloadHash: true,
  previousHash: true,
  anchorHash: true,
  signature: true,
  signatureAlgorithm: true,
  keyId: true,
  publicKey: true,
  createdAt: true,
  issuer: {
    select: {
      id: true,
      name: true,
      verified: true
    }
  }
} satisfies Prisma.AuditAnchorSelect;
