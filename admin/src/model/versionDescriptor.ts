import type { Channel, DraftInfo, ReleasedVersion } from '@admin/api/types';

// One row type for the versions sidebar: our releases, our drafts and the
// competitor courses all describe themselves the same way, so selection,
// comparison and the viewer never branch on where a course came from.

export type VersionKind = 'released' | 'draft' | 'competitor';

export type VersionDescriptor = {
  key: string;
  kind: VersionKind;
  courseId?: string;
  draftId?: string;
  competitorId?: string;
  label: string;
  version: string;
  name?: string;
  format: 'cards' | 'article' | 'slides';
  date: string;
  baseVersion?: string;
  // Which channels serve this release right now.
  channels?: Channel[];
  editable: boolean;
};

export const CHANNEL_CHIPS: Record<
  Channel,
  { chip: string; col: string; bg: string }
> = {
  staging: { chip: 'Staging', col: '#6D28D9', bg: 'rgba(124,58,237,.12)' },
  production: { chip: 'Prod', col: '#1D4ED8', bg: 'rgba(37,99,235,.12)' },
};

export const releasedKey = (courseId: string, version: string) =>
  `rel:${courseId}:${version}`;
export const draftKey = (courseId: string, draftId: string) =>
  `draft:${courseId}:${draftId}`;
export const competitorKey = (competitorId: string) => `comp:${competitorId}`;

const shortDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const describeReleased = (
  courseId: string,
  entry: ReleasedVersion,
): VersionDescriptor => ({
  key: releasedKey(courseId, entry.version),
  kind: 'released',
  courseId,
  label: `v${entry.version}`,
  version: entry.version,
  format: 'cards',
  date: shortDate(entry.releasedAt),
  channels: entry.channels,
  editable: false,
});

export const describeDraft = (draft: DraftInfo): VersionDescriptor => ({
  key: draftKey(draft.courseId, draft.draftId),
  kind: 'draft',
  courseId: draft.courseId,
  draftId: draft.draftId,
  label: `v${draft.versionLabel}`,
  version: draft.versionLabel,
  format: 'cards',
  date: shortDate(draft.updatedAt),
  baseVersion: draft.baseVersion,
  editable: true,
});

export const formatLabel = (format: VersionDescriptor['format']): string =>
  format === 'cards'
    ? 'Card sequence'
    : format === 'article'
    ? 'Article + quiz'
    : 'Slides + quiz';

export const statusOf = (descriptor: VersionDescriptor) =>
  descriptor.kind === 'draft'
    ? 'draft'
    : descriptor.kind === 'competitor'
    ? 'competitor'
    : 'released';
