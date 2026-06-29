import type { Chapter } from '@/services/audiobooks';

/** True when the chapter can be played or otherwise interacted with. */
export function canAccessChapter(chapter: Pick<Chapter, 'subscriptionAccess'>): boolean {
   return chapter.subscriptionAccess?.canAccess !== false;
}

/** Detects subscription-access changes for the same chapter ids (SSE cache refresh). */
export function getChapterListSyncSignature(
   chapters: Pick<Chapter, 'id' | 'subscriptionAccess'>[]
): string {
   return chapters
      .map((chapter) => {
         const canAccess = chapter.subscriptionAccess?.canAccess;
         const message = chapter.subscriptionAccess?.message ?? '';
         return `${chapter.id}:${String(canAccess)}:${message}`;
      })
      .join('|');
}
