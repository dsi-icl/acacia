export const stub = <T>(partial?: Partial<T>): T => {
    return partial != null ? (partial as T) : ({} as T);
};
