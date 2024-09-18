import { useState, useEffect, useCallback, useRef } from 'react';
import localForage from 'localforage';
import { message } from 'antd';
//  store local value for webauthn

type ErrorHandler = (e?: Error) => void;

const defaultErrorHandler: ErrorHandler = (e?: Error) => {
    void message.error(e?.toString());
};

export { localForage };

export function useLocalForage<D>(key: string, initialValue: D, errorHandler?: ErrorHandler) {
    const [storedValue, setStoredValue] = useState<D | null>(initialValue);
    const [isLoading, setIsLoading] = useState(true); // Add loading state
    const _errorHandler = useRef(
        (typeof errorHandler == 'undefined' || errorHandler == null) ? defaultErrorHandler : errorHandler
    );

    const error = (e?: Error) => {
        _errorHandler.current(e);
    };

    useEffect(() => {
        (async function () {
            try {
                const value: D | null = await localForage.getItem(key);
                setStoredValue(value == null ? initialValue : value);
            } catch (e) {
                error(e as Error);
            } finally {
                setIsLoading(false); // Done fetching
            }
        })().catch((e) => {
            error(e as Error);
            setIsLoading(false); // Ensure loading ends in case of an error
        });
    }, [initialValue, key]);

    // set value to local storage, may be async
    const setValue = useCallback((value: D) => {
        (async function set(value: D) {
            try {
                setStoredValue(value);
                await localForage.setItem(key, value);
            } catch (e) {
                error(e as Error);
            }
        })(value).catch((e) => {
            error(e as Error);
        });
    }, [key]);


    const removeValue = useCallback(() => {
        (async function remove() {
            try {
                setStoredValue(null);
                await localForage.removeItem(key);
            } catch (e) {
                error(e as Error);
            }
        })().catch((e) => {
            error(e as Error);
        });
    }, [key]);

    return [storedValue, setValue, removeValue, isLoading] as const;
}
