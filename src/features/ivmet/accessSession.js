import { safeStorage } from '../../shared/utils/storage';

// Solo memoria de esta pestaña: ni el código ni el pase se guardan
// en localStorage, sessionStorage, cookies, URLs o el bundle.
export function createAccessSession(readAuth, now = Date.now) {
  const empty = Object.freeze({ ticket: null, expiresAt: null, auth: null });
  let state = empty;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());
  const clear = () => {
    if (state === empty) return;
    state = empty;
    emit();
  };
  return {
    readAuth,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear,
    accept(data, authAtRequest) {
      const expiry = Date.parse(data?.expiresAt);
      if (
        !authAtRequest ||
        authAtRequest !== readAuth() ||
        typeof data?.ticket !== 'string' ||
        !data.ticket ||
        !Number.isFinite(expiry) ||
        expiry <= now()
      )
        return false;
      state = Object.freeze({
        ticket: data.ticket,
        expiresAt: expiry,
        auth: authAtRequest,
      });
      emit();
      return true;
    },
    headers() {
      if (!state.ticket) return {};
      if (state.auth !== readAuth() || state.expiresAt <= now()) {
        clear();
        return {};
      }
      return { 'X-Ivmet-Access': state.ticket };
    },
    handleError(error) {
      if (
        error.status === 401 ||
        ['IVMET_ACCESS_CODE_REQUIRED', 'IVMET_ACCESS_DENIED'].includes(
          error.data?.code,
        )
      )
        clear();
      throw error;
    },
  };
}

export const ivmetAccessSession = createAccessSession(() =>
  safeStorage.getItem('datamet_token'),
);
