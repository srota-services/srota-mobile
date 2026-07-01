import {
   normalizeM3u8Content,
   normalizeMediaUri,
   resolvePlaybackMediaUri,
} from '@/utils/m3u8Normalize';

jest.mock('@/services/api', () => ({
   STREAMING_API_BASE_URL: 'http://192.168.1.4:8082',
}));

describe('m3u8Normalize', () => {
   const context = { chapterId: 'chapter-1', bitrate: '128' };

   describe('normalizeMediaUri', () => {
      it('fixes backslashes in paths', () => {
         expect(normalizeMediaUri('bit_transcode\\chapter-1\\128k\\segment_000.m4s')).toBe(
            'bit_transcode/chapter-1/128k/segment_000.m4s'
         );
      });

      it('removes duplicated bit_transcode path segments', () => {
         const uri =
            'http://localhost:8082/bit_transcode/chapter-1/128k/bit_transcode/chapter-1/128k/segment_000.m4s';
         expect(normalizeMediaUri(uri)).toBe(
            'http://localhost:8082/bit_transcode/chapter-1/128k/segment_000.m4s'
         );
      });
   });

   describe('resolvePlaybackMediaUri', () => {
      it('rewrites absolute localhost URLs to the client streaming base', () => {
         expect(
            resolvePlaybackMediaUri(
               'http://localhost:8082/bit_transcode/chapter-1/128k/segment_000.m4s'
            )
         ).toBe('http://192.168.1.4:8082/bit_transcode/chapter-1/128k/segment_000.m4s');
      });

      it('preserves S3 pre-signed URLs unchanged', () => {
         const s3Url =
            'https://s3.ap-south-1.amazonaws.com/bucket/uploads/bit_transcode/chapter-1/128k/init.mp4?X-Amz-Signature=abc';
         expect(resolvePlaybackMediaUri(s3Url, context)).toBe(s3Url);
      });

      it('resolves relative bit_transcode paths', () => {
         expect(
            resolvePlaybackMediaUri('bit_transcode/chapter-1/128k/init.mp4')
         ).toBe('http://192.168.1.4:8082/bit_transcode/chapter-1/128k/init.mp4');
      });

      it('resolves bare segment filenames with chapter context', () => {
         expect(resolvePlaybackMediaUri('segment_000.m4s', context)).toBe(
            'http://192.168.1.4:8082/bit_transcode/chapter-1/128k/segment_000.m4s'
         );
      });
   });

   describe('normalizeM3u8Content', () => {
      it('rewrites init map and segment lines for localhost dev URLs', () => {
         const input = [
            '#EXTM3U',
            '#EXT-X-VERSION:7',
            '#EXT-X-MAP:URI="http://localhost:8082/bit_transcode/chapter-1/128k/init.mp4"',
            '',
            '#EXTINF:4.0,',
            'http://localhost:8082/bit_transcode/chapter-1/128k/segment_000.m4s',
         ].join('\n');

         const output = normalizeM3u8Content(input, context);

         expect(output).toContain(
            '#EXT-X-MAP:URI="http://192.168.1.4:8082/bit_transcode/chapter-1/128k/init.mp4"'
         );
         expect(output).toContain(
            'http://192.168.1.4:8082/bit_transcode/chapter-1/128k/segment_000.m4s'
         );
      });

      it('preserves S3 segment URLs in the playlist', () => {
         const s3Init =
            'https://s3.ap-south-1.amazonaws.com/bucket/init.mp4?X-Amz-Signature=abc';
         const s3Segment =
            'https://s3.ap-south-1.amazonaws.com/bucket/segment_000.m4s?X-Amz-Signature=def';
         const input = [
            '#EXTM3U',
            `#EXT-X-MAP:URI="${s3Init}"`,
            '#EXTINF:4.0,',
            s3Segment,
         ].join('\n');

         const output = normalizeM3u8Content(input, context);

         expect(output).toContain(`URI="${s3Init}"`);
         expect(output).toContain(s3Segment);
      });
   });
});
