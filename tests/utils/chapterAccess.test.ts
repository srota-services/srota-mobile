import { canAccessChapter, getChapterListSyncSignature } from '@/utils/chapterAccess';
import type { Chapter } from '@/services/audiobooks';

const baseChapter = {
   subscriptionAccess: undefined,
} as Pick<Chapter, 'subscriptionAccess'>;

describe('canAccessChapter', () => {
   it('allows access when subscriptionAccess is missing', () => {
      expect(canAccessChapter(baseChapter)).toBe(true);
   });

   it('allows access when canAccess is true', () => {
      expect(
         canAccessChapter({
            subscriptionAccess: { canAccess: true },
         })
      ).toBe(true);
   });

   it('denies access when canAccess is false', () => {
      expect(
         canAccessChapter({
            subscriptionAccess: { canAccess: false, message: 'Upgrade required' },
         })
      ).toBe(false);
   });
});

describe('getChapterListSyncSignature', () => {
   it('changes when subscription access changes for the same chapter ids', () => {
      const locked = getChapterListSyncSignature([
         {
            id: 'ch-1',
            subscriptionAccess: { canAccess: false, message: 'Upgrade required' },
         },
      ]);
      const unlocked = getChapterListSyncSignature([
         {
            id: 'ch-1',
            subscriptionAccess: { canAccess: true },
         },
      ]);

      expect(locked).not.toBe(unlocked);
   });

   it('is stable when chapter access is unchanged', () => {
      const chapters = [
         {
            id: 'ch-1',
            subscriptionAccess: { canAccess: true },
         },
         {
            id: 'ch-2',
            subscriptionAccess: { canAccess: false, message: 'Locked' },
         },
      ];

      expect(getChapterListSyncSignature(chapters)).toBe(
         getChapterListSyncSignature(chapters)
      );
   });
});
