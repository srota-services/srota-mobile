import { renderHook, waitFor } from '@testing-library/react-native';
import { useDomainEventsSync } from '@/hooks/useDomainEventsSync';
import { applyDomainCacheEvent } from '@/utils/applyDomainCacheEvent';

const mockConnectDomainEventStream = jest.fn();
const mockUseSelector = jest.fn();

jest.mock('@/services/domainEventsStream', () => ({
   connectDomainEventStream: (...args: unknown[]) =>
      mockConnectDomainEventStream(...args),
   DomainEventStreamAuthError: class DomainEventStreamAuthError extends Error {
      name = 'DomainEventStreamAuthError';
   },
}));

jest.mock('react-redux', () => ({
   useSelector: (selector: (state: unknown) => unknown) => mockUseSelector(selector),
}));

jest.mock('@/utils/applyDomainCacheEvent', () => ({
   applyDomainCacheEvent: jest.fn(),
}));

describe('useDomainEventsSync', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockConnectDomainEventStream.mockImplementation(
         async ({ onInvalidate, signal }: { onInvalidate: (event: unknown) => void; signal: AbortSignal }) => {
            if (signal.aborted) {
               return;
            }
            await new Promise<void>((resolve) => {
               signal.addEventListener('abort', () => resolve());
            });
         }
      );
   });

   it('does not connect when unauthenticated', () => {
      mockUseSelector.mockImplementation((selector) =>
         selector({
            auth: {
               accessToken: null,
               isAuthenticated: false,
               isInitialized: true,
            },
         })
      );

      renderHook(() => useDomainEventsSync());

      expect(mockConnectDomainEventStream).not.toHaveBeenCalled();
   });

   it('applies cache events from SSE', async () => {
      mockUseSelector.mockImplementation((selector) =>
         selector({
            auth: {
               accessToken: 'token-123',
               isAuthenticated: true,
               isInitialized: true,
            },
         })
      );

      const event = {
         version: 1,
         service: 'app',
         resource: 'audiobook',
         action: 'updated',
         id: 'ab-1',
         queryKeys: [['audiobooks'], ['audiobooks', 'ab-1']],
         timestamp: '2026-06-13T00:00:00.000Z',
      };

      mockConnectDomainEventStream.mockImplementation(
         async ({ onInvalidate }: { onInvalidate: (event: unknown) => void }) => {
            onInvalidate(event);
            await new Promise(() => undefined);
         }
      );

      renderHook(() => useDomainEventsSync());

      await waitFor(() => {
         expect(mockConnectDomainEventStream).toHaveBeenCalled();
      });

      await waitFor(() => {
         expect(applyDomainCacheEvent).toHaveBeenCalledWith(event, {
            currentUserId: null,
         });
      });
   });
});
