import type { Education } from './education-data';
import { requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';

// Share links (#236): API calls. The management screen is in share.tsx, the public page in share-page.tsx.

export const shareKinds = ['careers', 'projects', 'educations', 'certifications'] as const;
export type ShareKind = (typeof shareKinds)[number];

export const shareKindTitles: Record<ShareKind, string> = {
  careers: 'Career',
  projects: 'Projects',
  educations: 'Education',
  certifications: 'Certifications',
};

export type ShareLink = {
  id: number;
  label: string;
  counts: Record<ShareKind, number>;
  createdAt: string;
  revokedAt: string | null;
};

export type ShareInput = { label: string } & Partial<Record<ShareKind, number[]>>;

/** What the public page shows: only fields the server chose to publish. */
export type SharedPortfolio = {
  label: string;
  careers: {
    id: number;
    company: string;
    department: string | null;
    position: string | null;
    startDate: string;
    endDate: string | null;
    duties: string | null;
    achievements: string | null;
  }[];
  projects: {
    id: number;
    name: string;
    organization: string | null;
    startDate: string;
    endDate: string | null;
    role: string | null;
    summary: string | null;
    contributions: string | null;
    repositoryUrl: string | null;
    serviceUrl: string | null;
    skills: string[];
  }[];
  educations: {
    id: number;
    school: string;
    major: string;
    degree: Education['degree'];
    status: Education['status'];
    startDate: string;
    endDate: string | null;
  }[];
  certifications: {
    id: number;
    name: string;
    issuer: string | null;
    acquiredDate: string;
    expiryDate: string | null;
  }[];
};

export const shareLinksPath = '/api/share-links';
const sharePath = (token: string) => `/api/share/${encodeURIComponent(token)}`;
/** The page address a person sends; the token is the secret. */
export const shareUrl = (origin: string, token: string) =>
  `${origin}/share/${encodeURIComponent(token)}`;

export const shareApi = {
  create: (input: ShareInput) =>
    requestJson<{ shareLink: ShareLink; token: string }>(shareLinksPath, {
      method: 'POST',
      body: input,
    }),
  revoke: (id: number) =>
    requestJson<{ shareLink: ShareLink }>(`${shareLinksPath}/${String(id)}/revoke`, {
      method: 'POST',
    }),
  read: (token: string) => requestJson<SharedPortfolio>(sharePath(token)),
};

export function useShareLinks() {
  return useApiQuery<{ shareLinks: ShareLink[] }>(apiKey(shareLinksPath), shareLinksPath);
}
