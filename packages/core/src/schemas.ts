import { z } from "zod";
import { reasonCodeSchema } from "./reason-codes";

export const recordTypeSchema = z.enum([
  "certificate",
  "membership",
  "contribution",
  "ownership",
  "agreement",
  "warranty",
  "consent"
]);

export const recordStatusSchema = z.enum(["draft", "issued", "revoked", "expired", "disputed"]);
export const consentModeSchema = z.enum(["verify_only", "full_view", "one_time", "time_limited", "purpose_bound", "group", "anonymous"]);
export const consentStatusSchema = z.enum(["active", "revoked", "expired"]);
export const disputeStatusSchema = z.enum(["none", "open", "under_review", "resolved", "rejected"]);

export const certificateSubjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email().optional(),
  achievement: z.object({
    name: z.string().min(2),
    description: z.string().min(2),
    level: z.string().optional()
  }),
  completionDate: z.string().datetime(),
  cohort: z.string().optional()
});

export const issuerIdentitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  verified: z.boolean().default(false),
  authorizedRecordTypes: z.array(recordTypeSchema).default(["certificate"])
});

export const certificateCredentialSchema = z.object({
  "@context": z.array(z.string()).default([
    "https://www.w3.org/2018/credentials/v1",
    "https://opentrust.africa/credentials/v1"
  ]),
  id: z.string().min(1),
  type: z.array(z.string()).default(["VerifiableCredential", "OpenTrustCertificateCredential"]),
  issuer: issuerIdentitySchema,
  issuanceDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional(),
  credentialSubject: certificateSubjectSchema,
  evidence: z
    .array(
      z.object({
        type: z.string().min(2),
        hash: z.string().min(16),
        label: z.string().optional()
      })
    )
    .default([]),
  proof: z
    .object({
      type: z.literal("OpenTrustEd25519Signature2026"),
      created: z.string().datetime(),
      proofPurpose: z.literal("assertionMethod"),
      verificationMethod: z.string().min(1),
      publicKey: z.string().min(16),
      keyId: z.string().min(1),
      signature: z.string().min(16)
    })
    .optional()
});

export const publicCertificateSummarySchema = z.object({
  recordId: z.string().min(1),
  recordType: z.literal("certificate"),
  status: recordStatusSchema,
  issuer: issuerIdentitySchema.pick({ id: true, name: true, verified: true }),
  holderName: z.string().min(2),
  achievementName: z.string().min(2),
  achievementDescription: z.string().min(2),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  disputeStatus: disputeStatusSchema.default("none")
});

export const verificationResponseSchema = z.object({
  valid: z.boolean(),
  status: recordStatusSchema,
  issuer: issuerIdentitySchema.pick({ id: true, name: true, verified: true }),
  recordType: recordTypeSchema,
  disclosureMode: consentModeSchema,
  summary: publicCertificateSummarySchema,
  reasonCodes: z.array(reasonCodeSchema),
  trustScore: z
    .object({
      score: z.number().min(0).max(100),
      band: z.string()
    })
    .optional(),
  verifiedAt: z.string().datetime(),
  cacheState: z.enum(["fresh", "offline_cache"]).default("fresh")
});

export type RecordType = z.infer<typeof recordTypeSchema>;
export type RecordStatus = z.infer<typeof recordStatusSchema>;
export type ConsentMode = z.infer<typeof consentModeSchema>;
export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type CertificateCredential = z.infer<typeof certificateCredentialSchema>;
export type PublicCertificateSummary = z.infer<typeof publicCertificateSummarySchema>;
export type VerificationResponse = z.infer<typeof verificationResponseSchema>;
